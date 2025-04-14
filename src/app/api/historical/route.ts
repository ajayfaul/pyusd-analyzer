// --- File yang Diperbarui: src/app/api/historical/route.ts ---
// Deskripsi: Mengganti 'gas_limit' menjadi 'gas' pada query congestion.

import { NextResponse, NextRequest } from "next/server";
import {
  BigQuery,
  BigQueryDate,
  BigQueryTimestamp,
} from "@google-cloud/bigquery";
import { formatUnits, Hex } from "viem";

// --- Konfigurasi ---
const PYUSD_CONTRACT_ADDRESS_BQ = "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const PYUSD_DECIMALS = 6;
const LOCATION = "US";
const GWEI_DIVISOR = 10 ** 9;
// --- Akhir Konfigurasi ---

const bigqueryClient = new BigQuery();

// --- Interfaces ---
interface MergedTransferData {
  date: string;
  count: number;
  volume: number | null;
}
interface ActiveAddressRow {
  transfer_date: { value: string };
  active_senders: number;
}
interface TopTransferRawRow {
  block_timestamp: { value: string };
  transaction_hash: string;
  log_index: number;
  from_address: string;
  to_address: string;
  value: string;
  token_address: string;
}
interface TopTransferFormattedRow {
  timestamp: string;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  rawValue: string;
  formattedValue: string | null;
  tokenAddress: string;
}
interface GasPriceRow {
  // Ditambahkan kembali
  tx_date: { value: string }; // BigQueryDate
  avg_gas_gwei: number | null; // Allow null
}
interface CongestionRow {
  tx_date: { value: string }; // BigQueryDate
  avg_gas_limit_used_percent: number | null; // Allow null
}
// --- Akhir Interfaces ---

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryType = searchParams.get("type");
  const timezone = "Asia/Jakarta";
  console.log(
    `Received request for historical data, type: ${
      queryType ?? "transfers (default)"
    }`
  );

  // --- Logika untuk Data Transfer Harian PYUSD (Default) ---
  if (queryType === "transfers" || !queryType) {
    const countQuery = ` SELECT DATE(block_timestamp) AS transfer_date, COUNT(*) AS transaction_count FROM \`bigquery-public-data.crypto_ethereum.token_transfers\` WHERE token_address = @pyusd_address AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY) GROUP BY transfer_date; `;
    const volumeQuery = ` SELECT DATE(block_timestamp) AS transfer_date, SUM(SAFE_CAST(value AS BIGNUMERIC)) / @divisor AS total_volume FROM \`bigquery-public-data.crypto_ethereum.token_transfers\` WHERE token_address = @pyusd_address AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY) GROUP BY transfer_date; `;
    const options = {
      location: LOCATION,
      params: {
        pyusd_address: PYUSD_CONTRACT_ADDRESS_BQ,
        divisor: 10 ** PYUSD_DECIMALS,
        timezone: timezone,
      },
    };
    try {
      /* ... (logika fetch dan merge sama) ... */ console.log(
        "Executing BigQuery queries for count and volume..."
      );
      const [countJob] = await bigqueryClient.createQueryJob({
        ...options,
        query: countQuery,
      });
      const [volumeJob] = await bigqueryClient.createQueryJob({
        ...options,
        query: volumeQuery,
      });
      const [[countRows], [volumeRows]] = await Promise.all([
        countJob.getQueryResults(),
        volumeJob.getQueryResults(),
      ]);
      console.log(`Count query successful, received ${countRows.length} rows.`);
      console.log(
        `Volume query successful, received ${volumeRows.length} rows.`
      );
      const mergedDataMap = new Map<string, MergedTransferData>();
      countRows.forEach((row) => {
        const dateStr = (row.transfer_date as BigQueryDate).value;
        if (dateStr) {
          mergedDataMap.set(dateStr, {
            date: dateStr,
            count: Number(row.transaction_count) || 0,
            volume: null,
          });
        }
      });
      volumeRows.forEach((row) => {
        const dateStr = (row.transfer_date as BigQueryDate).value;
        if (dateStr && mergedDataMap.has(dateStr)) {
          const existingData = mergedDataMap.get(dateStr)!;
          existingData.volume =
            row.total_volume !== null ? Number(row.total_volume) : 0;
        } else if (dateStr) {
          mergedDataMap.set(dateStr, {
            date: dateStr,
            count: 0,
            volume: row.total_volume !== null ? Number(row.total_volume) : 0,
          });
        }
      });
      const finalData = Array.from(mergedDataMap.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      return NextResponse.json(
        { type: "transfers", data: finalData },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("BIGQUERY_QUERY_ERROR (Transfers):", error);
      return NextResponse.json(
        {
          message:
            error.message || "Gagal mengambil data transfer dari BigQuery.",
        },
        { status: 500 }
      );
    }
  }
  // --- Logika untuk Alamat Aktif Harian ---
  else if (queryType === "active_addresses") {
    const activeAddressQuery = ` SELECT DATE(block_timestamp) AS transfer_date, COUNT(DISTINCT from_address) AS active_senders FROM \`bigquery-public-data.crypto_ethereum.token_transfers\` WHERE token_address = @pyusd_address AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY) GROUP BY transfer_date ORDER BY transfer_date DESC; `;
    const options = {
      query: activeAddressQuery,
      location: LOCATION,
      params: { pyusd_address: PYUSD_CONTRACT_ADDRESS_BQ, timezone: timezone },
    };
    try {
      console.log("Executing BigQuery query for daily active PYUSD senders...");
      const [rows] = await bigqueryClient.query(options);
      console.log(
        `Active address query successful, received ${rows.length} rows.`
      );
      const formattedRows = rows.map((row: ActiveAddressRow) => ({
        date: (row.transfer_date as BigQueryDate).value,
        active_senders: Number(row.active_senders) || 0,
      }));
      return NextResponse.json(
        { type: "active_addresses", data: formattedRows },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("BIGQUERY_QUERY_ERROR (Active Addresses):", error);
      return NextResponse.json(
        {
          message:
            error.message || "Gagal mengambil data alamat aktif dari BigQuery.",
        },
        { status: 500 }
      );
    }
  }
  // --- Logika untuk Top Transfers ---
  else if (queryType === "top_transfers") {
    const topTransfersQuery = ` SELECT block_timestamp, transaction_hash, log_index, from_address, to_address, value, token_address FROM \`bigquery-public-data.crypto_ethereum.token_transfers\` WHERE token_address = @pyusd_address AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY) ORDER BY SAFE_CAST(value AS BIGNUMERIC) DESC LIMIT 10; `;
    const options = {
      query: topTransfersQuery,
      location: LOCATION,
      params: { pyusd_address: PYUSD_CONTRACT_ADDRESS_BQ, timezone: timezone },
    };
    try {
      console.log("Executing BigQuery query for top PYUSD transfers...");
      const [rows] = await bigqueryClient.query(options);
      console.log(
        `Top transfers query successful, received ${rows.length} rows.`
      );
      const formattedRows: TopTransferFormattedRow[] = rows.map(
        (row: TopTransferRawRow) => {
          let formattedValue: string | null = `Raw: ${row.value}`;
          if (
            row.token_address.toLowerCase() ===
            PYUSD_CONTRACT_ADDRESS_BQ.toLowerCase()
          ) {
            try {
              const bigIntValue = BigInt(row.value);
              formattedValue = `${formatUnits(
                bigIntValue,
                PYUSD_DECIMALS
              )} PYUSD`;
            } catch (e) {
              console.error(
                `Failed to format value for top transfer:`,
                row.value,
                e
              );
              formattedValue = `Error format: ${row.value}`;
            }
          }
          return {
            timestamp: (row.block_timestamp as BigQueryTimestamp).value,
            txHash: row.transaction_hash,
            logIndex: row.log_index,
            fromAddress: row.from_address,
            toAddress: row.to_address,
            rawValue: row.value,
            formattedValue: formattedValue,
            tokenAddress: row.token_address,
          };
        }
      );
      return NextResponse.json(
        { type: "top_transfers", data: formattedRows },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("BIGQUERY_QUERY_ERROR (Top Transfers):", error);
      return NextResponse.json(
        {
          message:
            error.message || "Gagal mengambil data top transfer dari BigQuery.",
        },
        { status: 500 }
      );
    }
  }
  // --- Logika untuk Rata-rata Gas Price Harian ---
  else if (queryType === "gas") {
    const gasQuery = ` SELECT DATE(block_timestamp) AS tx_date, AVG(SAFE_CAST(gas_price AS BIGNUMERIC)) / @gwei_divisor AS avg_gas_gwei FROM \`bigquery-public-data.crypto_ethereum.transactions\` WHERE DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY) AND receipt_status = 1 GROUP BY tx_date ORDER BY tx_date ASC; `;
    const options = {
      query: gasQuery,
      location: LOCATION,
      params: { gwei_divisor: GWEI_DIVISOR, timezone: timezone },
    };
    try {
      console.log("Executing BigQuery query for average daily gas price...");
      const [rows] = await bigqueryClient.query(options);
      console.log(`Gas price query successful, received ${rows.length} rows.`);
      const formattedRows = rows.map((row: GasPriceRow) => ({
        date: (row.tx_date as BigQueryDate).value,
        avg_gas_gwei:
          row.avg_gas_gwei !== null
            ? Number(Number(row.avg_gas_gwei).toFixed(2))
            : null,
      }));
      return NextResponse.json(
        { type: "gas", data: formattedRows },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("BIGQUERY_QUERY_ERROR (Gas Price):", error);
      return NextResponse.json(
        {
          message:
            error.message || "Gagal mengambil data harga gas dari BigQuery.",
        },
        { status: 500 }
      );
    }
  }
  // --- Logika untuk Congestion (Gas Limit Usage %) ---
  else if (queryType === "congestion") {
    const congestionQuery = `
                SELECT
                    DATE(block_timestamp) AS tx_date,
                    -- FIX: Ganti gas_limit menjadi gas
                    SAFE_MULTIPLY(AVG(SAFE_DIVIDE(SAFE_CAST(receipt_gas_used AS BIGNUMERIC), SAFE_CAST(gas AS BIGNUMERIC))), 100) AS avg_gas_limit_used_percent
                FROM \`bigquery-public-data.crypto_ethereum.transactions\`
                WHERE DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY)
                  AND receipt_status = 1
                  -- FIX: Ganti gas_limit menjadi gas
                  AND gas > 0
                GROUP BY tx_date
                ORDER BY tx_date ASC;
            `;
    const options = {
      query: congestionQuery,
      location: LOCATION,
      params: { timezone: timezone },
    };
    try {
      console.log("Executing BigQuery query for daily avg gas limit usage...");
      const [rows] = await bigqueryClient.query(options);
      console.log(`Congestion query successful, received ${rows.length} rows.`);
      const formattedRows = rows.map((row: CongestionRow) => ({
        date: (row.tx_date as BigQueryDate).value,
        avg_gas_limit_used_percent:
          row.avg_gas_limit_used_percent !== null
            ? Number(Number(row.avg_gas_limit_used_percent).toFixed(2))
            : null,
      }));
      return NextResponse.json(
        { type: "congestion", data: formattedRows },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("BIGQUERY_QUERY_ERROR (Congestion):", error);
      return NextResponse.json(
        {
          message:
            error.message || "Gagal mengambil data congestion dari BigQuery.",
        },
        { status: 500 }
      );
    }
  }
  // --- Akhir Logika Baru ---
  else {
    return NextResponse.json(
      { message: `Tipe query tidak dikenal: ${queryType}` },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { BigQuery, BigQueryDate } from "@google-cloud/bigquery"; // Import BigQueryDate

// Konfigurasi
const PYUSD_CONTRACT_ADDRESS_BQ = "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const LOCATION = "US";
const PYUSD_DIVISOR = 10 ** 6; // 10 pangkat 6 untuk 6 desimal

const bigqueryClient = new BigQuery();

// Tipe untuk hasil gabungan
interface MergedHistoricalData {
  date: string;
  count: number;
  volume: number | null; // Volume bisa null jika tidak ada transfer pada hari itu
}

export async function GET(request: Request) {
  console.log("Received request for historical data (count and volume)...");

  // Query 1: Menghitung jumlah transfer
  const countQuery = `
        SELECT
            DATE(block_timestamp) AS transfer_date,
            COUNT(*) AS transaction_count
        FROM
            \`bigquery-public-data.crypto_ethereum.token_transfers\`
        WHERE
            token_address = @pyusd_address
            AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY)
        GROUP BY
            transfer_date;
    `;

  // Query 2: Menghitung total volume transfer (memperhatikan desimal)
  const volumeQuery = `
        SELECT
            DATE(block_timestamp) AS transfer_date,
            SUM(CAST(value AS BIGNUMERIC)) / @divisor AS total_volume -- Cast ke BIGNUMERIC, lalu bagi
        FROM
            \`bigquery-public-data.crypto_ethereum.token_transfers\`
        WHERE
            token_address = @pyusd_address
            AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY)
        GROUP BY
            transfer_date;
    `;

  const options = {
    location: LOCATION,
    params: {
      pyusd_address: PYUSD_CONTRACT_ADDRESS_BQ,
      divisor: PYUSD_DIVISOR,
      timezone: "Asia/Jakarta", // Sesuaikan jika perlu
    },
  };

  try {
    console.log("Executing BigQuery queries for count and volume...");
    // Jalankan kedua query secara paralel
    const [countJob] = await bigqueryClient.createQueryJob({
      ...options,
      query: countQuery,
    });
    const [volumeJob] = await bigqueryClient.createQueryJob({
      ...options,
      query: volumeQuery,
    });

    // Tunggu hasil kedua query
    const [[countRows], [volumeRows]] = await Promise.all([
      countJob.getQueryResults(),
      volumeJob.getQueryResults(),
    ]);

    console.log(`Count query successful, received ${countRows.length} rows.`);
    console.log(`Volume query successful, received ${volumeRows.length} rows.`);

    // Gabungkan hasil berdasarkan tanggal
    const mergedDataMap = new Map<string, MergedHistoricalData>();

    // Proses hasil count query
    countRows.forEach((row) => {
      // Akses tanggal dari objek BigQueryDate
      const dateStr = (row.transfer_date as BigQueryDate).value;
      if (dateStr) {
        mergedDataMap.set(dateStr, {
          date: dateStr,
          count: Number(row.transaction_count) || 0, // Konversi ke number
          volume: null, // Inisialisasi volume
        });
      }
    });

    // Proses hasil volume query dan gabungkan
    volumeRows.forEach((row) => {
      const dateStr = (row.transfer_date as BigQueryDate).value;
      if (dateStr && mergedDataMap.has(dateStr)) {
        const existingData = mergedDataMap.get(dateStr)!;
        // Hasil SUM(CAST(... AS BIGNUMERIC)) / divisor akan menjadi tipe float/number
        existingData.volume =
          row.total_volume !== null ? Number(row.total_volume) : 0;
      } else if (dateStr) {
        // Jika tanggal tidak ada di count (jarang terjadi), tambahkan entri baru
        mergedDataMap.set(dateStr, {
          date: dateStr,
          count: 0,
          volume: row.total_volume !== null ? Number(row.total_volume) : 0,
        });
      }
    });

    // Konversi map ke array dan urutkan berdasarkan tanggal (descending)
    const finalData = Array.from(mergedDataMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    return NextResponse.json({ data: finalData }, { status: 200 });
  } catch (error: any) {
    console.error("BIGQUERY_QUERY_ERROR:", error);
    return NextResponse.json(
      { message: error.message || "Gagal mengambil data dari BigQuery." },
      { status: 500 }
    );
  }
}

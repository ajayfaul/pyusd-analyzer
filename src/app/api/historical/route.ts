import { NextResponse } from "next/server";
// Import BigQuery client library
import { BigQuery } from "@google-cloud/bigquery";

// Konfigurasi (bisa dipindahkan ke env var jika perlu)
const PYUSD_CONTRACT_ADDRESS_BQ = "0x6c3ea9036406852006290770bedfcaba0e23a0e8"; // Alamat PYUSD (perlu dicek format di BQ)
const LOCATION = "US"; // Lokasi dataset BigQuery public

// Inisialisasi BigQuery client
// Library akan otomatis mencari credentials dari environment variable
// GOOGLE_APPLICATION_CREDENTIALS atau default lainnya.
const bigqueryClient = new BigQuery();

// Handler untuk method GET (contoh: mengambil data tanpa parameter)
export async function GET(request: Request) {
  console.log("Received request for historical data...");

  // Contoh Query: Menghitung jumlah transfer PYUSD per hari selama 7 hari terakhir
  // Dataset: bigquery-public-data.crypto_ethereum
  // Tabel: token_transfers
  const query = `
            SELECT
                DATE(block_timestamp) AS transfer_date,
                COUNT(*) AS transaction_count
            FROM
                \`bigquery-public-data.crypto_ethereum.token_transfers\`
            WHERE
                token_address = @pyusd_address
                AND DATE(block_timestamp) >= DATE_SUB(CURRENT_DATE(@timezone), INTERVAL 7 DAY)
            GROUP BY
                transfer_date
            ORDER BY
                transfer_date DESC;
        `;

  const options = {
    query: query,
    location: LOCATION, // Lokasi dataset public
    params: {
      // Parameter untuk mencegah SQL injection
      pyusd_address: PYUSD_CONTRACT_ADDRESS_BQ,
      timezone: "Asia/Jakarta", // Sesuaikan timezone jika perlu
    },
  };

  try {
    console.log("Executing BigQuery query...");
    // Jalankan query
    const [rows] = await bigqueryClient.query(options);

    console.log(`Query successful, received ${rows.length} rows.`);

    // Kirim hasil ke frontend
    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (error: any) {
    console.error("BIGQUERY_QUERY_ERROR:", error);
    // Kirim response error generik
    return NextResponse.json(
      { message: error.message || "Gagal mengambil data dari BigQuery." },
      { status: 500 }
    );
  }
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
// Import interfaces (jika tidak menggunakan file terpisah)
// import type { HistoricalRow } from '@/types/analysis'; // Ganti dengan interface baru

// Interface baru untuk data gabungan
interface MergedHistoricalRow {
  date: string;
  count: number;
  volume: number | null;
}

const HistoricalDashboard: React.FC = () => {
  // Gunakan interface baru untuk state
  const [data, setData] = useState<MergedHistoricalRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/historical");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `Gagal mengambil data historis: ${response.statusText}`
          );
        }
        const result = await response.json();
        if (!result.data) {
          throw new Error("Format data historis tidak valid dari server.");
        }
        // Set data dengan struktur baru
        setData(result.data);
      } catch (err: any) {
        console.error("Error fetching historical data:", err);
        setError(err.message || "Gagal memuat data historis.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const LoadingSkeleton = () => (
    /* ... (sama seperti sebelumnya) ... */ <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Analisis Historis PYUSD (7 Hari Terakhir)</CardTitle>
          <CardDescription>
            Jumlah dan volume transaksi transfer PYUSD harian dari BigQuery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {error && !isLoading && (
            <Alert variant="destructive">
              {" "}
              <AlertCircle className="h-4 w-4" />{" "}
              <AlertTitle>Error Memuat Data Historis</AlertTitle>{" "}
              <AlertDescription>{error}</AlertDescription>{" "}
            </Alert>
          )}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Jumlah Transfer</TableHead>
                  {/* Tambah Kolom Volume */}
                  <TableHead className="text-right">
                    Total Volume (PYUSD)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length > 0 ? (
                  data.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right">
                        {row.count.toLocaleString()}
                      </TableCell>
                      {/* Tampilkan Volume */}
                      <TableCell className="text-right">
                        {row.volume !== null
                          ? row.volume.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      Tidak ada data historis ditemukan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Tambahkan Card lain untuk analisis historis berbeda di sini */}
    </div>
  );
};

export default HistoricalDashboard;

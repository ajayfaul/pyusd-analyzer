"use client"; // Komponen ini perlu state, jadi client component

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
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

// Tipe data yang diharapkan dari API /api/historical
interface HistoricalRow {
  transfer_date: { value: string }; // BigQuery Date object
  transaction_count: number;
}

const HistoricalData: React.FC = () => {
  const [data, setData] = useState<HistoricalRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/historical"); // Panggil endpoint GET
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
        setData(result.data);
      } catch (err: any) {
        console.error("Error fetching historical data:", err);
        setError(err.message || "Gagal memuat data historis.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Dependency array kosong agar fetch hanya dijalankan sekali saat mount

  if (isLoading) {
    return (
      <Card>
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
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Memuat Data Historis</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analisis Historis (7 Hari Terakhir)</CardTitle>
        <CardDescription>
          Jumlah transaksi transfer PYUSD harian.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead className="text-right">Jumlah Transfer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((row) => (
                <TableRow key={row.transfer_date.value}>
                  <TableCell>{row.transfer_date.value}</TableCell>
                  <TableCell className="text-right">
                    {row.transaction_count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="text-center">
                  Tidak ada data historis ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default HistoricalData;

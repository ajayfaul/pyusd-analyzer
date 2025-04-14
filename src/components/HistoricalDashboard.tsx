'use client';

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, LinkIcon, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title as ChartJsTitle, Tooltip as ChartJsTooltip, Legend, Filler
} from 'chart.js';

import type { MergedHistoricalRow } from '@/types/analysis';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ChartJsTitle, ChartJsTooltip, Legend, Filler
);

interface GasPriceData {
  date: string;
  avg_gas_gwei: number | null;
}

const EtherscanLink: React.FC<{ type: 'tx' | 'address'; hash: string; children?: React.ReactNode; className?: string }> = ({ type, hash, children, className }) => {
  const baseUrl = "https://etherscan.io";
  const url = `${baseUrl}/${type}/${hash}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`text-blue-600 hover:underline inline-flex items-center gap-1 ${className}`} title={`Lihat di Etherscan (${type})`}>
      {children || hash}
      <LinkIcon className="h-3 w-3" />
    </a>
  );
};

const HexDisplay: React.FC<{ value: string; prefix?: string; isAddress?: boolean }> = ({ value, prefix = "0x", isAddress = false }) => {
  if (!value || typeof value !== 'string' || !value.startsWith('0x')) {
    return <span className="font-mono break-all">{value || 'N/A'}</span>;
  }
  const maxLength = isAddress ? 14 : 10;
  const endLength = isAddress ? 4 : 4;
  const startLength = maxLength - endLength - 3;
  if (value.length <= maxLength) {
    return <span className="font-mono break-all">{value}</span>;
  }
  const truncated = `${prefix}${value.substring(2, 2 + startLength)}...${value.substring(value.length - endLength)}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="font-mono cursor-help">{truncated}</span></TooltipTrigger>
      <TooltipContent className="max-w-md"><p className="break-all">{value}</p></TooltipContent>
    </Tooltip>
  );
};

const HistoricalDashboard: React.FC = () => {
  const [transferData, setTransferData] = useState<MergedHistoricalRow[]>([]);
  const [isTransferLoading, setIsTransferLoading] = useState<boolean>(true);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [gasData, setGasData] = useState<GasPriceData[]>([]);
  const [isGasLoading, setIsGasLoading] = useState<boolean>(true);
  const [gasError, setGasError] = useState<string | null>(null);
  const [activeAddressData, setActiveAddressData] = useState<{ date: string; active_senders: number; }[]>([]);
  const [isActiveAddressLoading, setIsActiveAddressLoading] = useState<boolean>(true);
  const [activeAddressError, setActiveAddressError] = useState<string | null>(null);

  const fetchData = async <T,>(
    url: string,
    setData: React.Dispatch<React.SetStateAction<T[]>>,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    expectedType: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gagal (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) errorMessage = errorJson.message;
        } catch (parseError) {
          errorMessage = errorText || `Gagal (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      if (result.type !== expectedType || !result.data) {
        throw new Error(`Format data ${expectedType} tdk valid.`);
      }
      setData(result.data);
    } catch (err: any) {
      console.error(`Error fetching ${url}:`, err);
      setError(err.message || `Gagal memuat data ${expectedType}.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData('/api/historical', setTransferData, setIsTransferLoading, setTransferError, 'transfers'); }, []);
  useEffect(() => { fetchData('/api/historical?type=gas', setGasData, setIsGasLoading, setGasError, 'gas'); }, []);
  useEffect(() => { fetchData('/api/historical?type=active_addresses', setActiveAddressData, setIsActiveAddressLoading, setActiveAddressError, 'active_addresses'); }, []);

  const LoadingSkeleton = () => (
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

  const ChartLoadingSkeleton = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-72 w-full" />
      </CardContent>
    </Card>
  );

  const gasChartJsData = {
    labels: gasData.map(d => d.date.slice(5)),
    datasets: [
      {
        label: 'Avg Gas (Gwei)',
        data: gasData.map(d => d.avg_gas_gwei),
        borderColor: '#2563eb',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(37, 99, 235, 0.5)');
          gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#1e40af',
        pointHoverBorderColor: '#ffffff',
        borderWidth: 3,
        spanGaps: true,
      },
    ],
  };

  const gasChartJsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#000000',
        bodyColor: '#000000',
        padding: 12,
        boxPadding: 6,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems: any) => `Tanggal: ${gasData[tooltipItems[0].dataIndex]?.date}`,
          label: (tooltipItem: any) => `Avg Gas: ${tooltipItem.formattedValue} Gwei`,
        }
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: 'hsl(var(--foreground))',
          font: { size: 12, weight: '500' },
          maxRotation: 0,
          autoSkipPadding: 20,
          padding: 8,
        },
      },
      y: {
        border: { display: false },
        grid: { color: 'hsl(var(--border))' },
        ticks: {
          color: 'hsl(var(--foreground))',
          font: { size: 12, weight: '500' },
          padding: 8,
          callback: (value: any) => `${value} Gwei`
        },
        beginAtZero: false
      },
    },
  };

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 max-w-7xl">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-2">
          <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">Transfer Harian PYUSD <span className="text-sm font-normal text-muted-foreground">(7 Hari Terakhir)</span></CardTitle>
            <CardDescription>Jumlah dan volume transaksi transfer PYUSD harian dari BigQuery.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isTransferLoading && (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full animate-pulse" />
                <Skeleton className="h-8 w-full animate-pulse" />
                <Skeleton className="h-8 w-full animate-pulse" />
              </div>
            )}
            {transferError && !isTransferLoading && (
              <Alert variant="destructive" className="animate-in fade-in-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Memuat Data Transfer</AlertTitle>
                <AlertDescription>{transferError}</AlertDescription>
              </Alert>
            )}
            {!isTransferLoading && !transferError && (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/50">
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Jumlah Transfer</TableHead>
                    <TableHead className="text-right">Total Volume (PYUSD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferData.length > 0 ? (
                    transferData.map((row) => (
                      <TableRow key={row.date} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{row.date}</TableCell>
                        <TableCell className="text-right font-medium">{row.count.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">
                          {row.volume !== null ? row.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">Tidak ada data.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Rata-rata Harga Gas Harian (7 Hari Terakhir)</CardTitle>
            <CardDescription>Rata-rata gas price (Gwei) transaksi sukses harian di Ethereum.</CardDescription>
          </CardHeader>
          <CardContent>
            {isGasLoading && <Skeleton className="h-72 w-full" />}
            {gasError && !isGasLoading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Memuat Data Gas</AlertTitle>
                <AlertDescription>{gasError}</AlertDescription>
              </Alert>
            )}
            {!isGasLoading && !gasError && gasData.length > 0 && (
              <div className="h-[300px] w-full">
                <Line data={gasChartJsData} options={gasChartJsOptions as any} />
              </div>
            )}
            {!isGasLoading && !gasError && gasData.length === 0 && (
              <p className="text-center text-muted-foreground py-10">Tidak ada data harga gas ditemukan.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="border-b border-border/20">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">Pengirim Aktif PYUSD <span className="text-sm font-normal text-muted-foreground">(7 Hari Terakhir)</span></CardTitle>
            <CardDescription>Jumlah alamat unik yang mengirimkan PYUSD setiap hari.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isActiveAddressLoading && (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full animate-pulse" />
                <Skeleton className="h-8 w-full animate-pulse" />
                <Skeleton className="h-8 w-full animate-pulse" />
              </div>
            )}
            {activeAddressError && !isActiveAddressLoading && (
              <Alert variant="destructive" className="animate-in fade-in-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Memuat Data Alamat Aktif</AlertTitle>
                <AlertDescription>{activeAddressError}</AlertDescription>
              </Alert>
            )}
            {!isActiveAddressLoading && !activeAddressError && (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/50">
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Jumlah Pengirim Unik</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAddressData.length > 0 ? (
                    activeAddressData.map((row) => (
                      <TableRow key={row.date} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{row.date}</TableCell>
                        <TableCell className="text-right font-medium">{row.active_senders.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">Tidak ada data alamat aktif ditemukan.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistoricalDashboard;

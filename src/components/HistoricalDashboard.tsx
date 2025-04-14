// --- File yang Diperbarui: src/components/HistoricalDashboard.tsx ---
// Deskripsi: Menambahkan Card untuk Top Transfers dan Congestion Chart.

"use client";

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
import { AlertCircle, LinkIcon, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Import Chart.js dan wrapper React + elemen yang dibutuhkan (Line, Bar)
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Tambahkan BarElement
  Title as ChartJsTitle,
  Tooltip as ChartJsTooltip,
  Legend,
  Filler,
} from "chart.js";
// Import interfaces
import type { MergedHistoricalRow } from "@/types/analysis"; // Sesuaikan path jika perlu

// Daftarkan elemen Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ChartJsTitle,
  ChartJsTooltip,
  Legend,
  Filler
); // Tambahkan BarElement

// --- Interfaces ---
interface GasPriceData {
  date: string;
  avg_gas_gwei: number | null;
}
interface ActiveAddressData {
  date: string;
  active_senders: number;
}
// Interface untuk Top Transfers
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
// Interface untuk Congestion
interface CongestionData {
  date: string;
  avg_gas_limit_used_percent: number | null;
}
// --- Akhir Interfaces ---

// Helper components (sama)
const EtherscanLink: React.FC<{
  type: "tx" | "address";
  hash: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ type, hash, children, className }) => {
  const baseUrl = "https://etherscan.io";
  const url = `${baseUrl}/${type}/${hash}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-600 hover:underline inline-flex items-center gap-1 ${className}`}
      title={`Lihat di Etherscan (${type})`}
    >
      {" "}
      {children || hash} <LinkIcon className="h-3 w-3" />{" "}
    </a>
  );
};
const HexDisplay: React.FC<{
  value: string;
  prefix?: string;
  isAddress?: boolean;
}> = ({ value, prefix = "0x", isAddress = false }) => {
  if (!value || typeof value !== "string" || !value.startsWith("0x")) {
    return <span className="font-mono break-all">{value || "N/A"}</span>;
  }
  const maxLength = isAddress ? 14 : 10;
  const endLength = 4;
  const startLength = isAddress ? 5 : 4;
  if (value.length <= maxLength) {
    return <span className="font-mono break-all">{value}</span>;
  }
  const truncated = `${prefix}${value.substring(
    2,
    2 + startLength
  )}...${value.substring(value.length - endLength)}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono cursor-help">{truncated}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <p className="break-all font-mono">{value}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const HistoricalDashboard: React.FC = () => {
  // State yang sudah ada
  const [transferData, setTransferData] = useState<MergedHistoricalRow[]>([]);
  const [isTransferLoading, setIsTransferLoading] = useState<boolean>(true);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [gasData, setGasData] = useState<GasPriceData[]>([]);
  const [isGasLoading, setIsGasLoading] = useState<boolean>(true);
  const [gasError, setGasError] = useState<string | null>(null);
  const [activeAddressData, setActiveAddressData] = useState<
    ActiveAddressData[]
  >([]);
  const [isActiveAddressLoading, setIsActiveAddressLoading] =
    useState<boolean>(true);
  const [activeAddressError, setActiveAddressError] = useState<string | null>(
    null
  );
  // State BARU untuk Top Transfers & Congestion
  const [topTransferData, setTopTransferData] = useState<
    TopTransferFormattedRow[]
  >([]);
  const [isTopTransferLoading, setIsTopTransferLoading] =
    useState<boolean>(true);
  const [topTransferError, setTopTransferError] = useState<string | null>(null);
  const [congestionData, setCongestionData] = useState<CongestionData[]>([]);
  const [isCongestionLoading, setIsCongestionLoading] = useState<boolean>(true);
  const [congestionError, setCongestionError] = useState<string | null>(null);

  // Generic fetch function (sama)
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

  // Fetch data (tambahkan fetch untuk top_transfers dan congestion)
  useEffect(() => {
    fetchData(
      "/api/historical?type=transfers",
      setTransferData,
      setIsTransferLoading,
      setTransferError,
      "transfers"
    );
  }, []);
  useEffect(() => {
    fetchData(
      "/api/historical?type=gas",
      setGasData,
      setIsGasLoading,
      setGasError,
      "gas"
    );
  }, []);
  useEffect(() => {
    fetchData(
      "/api/historical?type=active_addresses",
      setActiveAddressData,
      setIsActiveAddressLoading,
      setActiveAddressError,
      "active_addresses"
    );
  }, []);
  useEffect(() => {
    fetchData(
      "/api/historical?type=top_transfers",
      setTopTransferData,
      setIsTopTransferLoading,
      setTopTransferError,
      "top_transfers"
    );
  }, []); // Fetch Top Transfers
  useEffect(() => {
    fetchData(
      "/api/historical?type=congestion",
      setCongestionData,
      setIsCongestionLoading,
      setCongestionError,
      "congestion"
    );
  }, []); // Fetch Congestion

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

  // Konfigurasi Chart.js Gas Price (sama)
  const gasChartJsData = {
    labels: gasData.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "Avg Gas (Gwei)",
        data: gasData.map((d) => d.avg_gas_gwei),
        borderColor: "#2563eb",
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, "rgba(37, 99, 235, 0.5)");
          gradient.addColorStop(1, "rgba(37, 99, 235, 0.0)");
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#2563eb",
        pointBorderColor: "#ffffff",
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#1e40af",
        pointHoverBorderColor: "#ffffff",
        borderWidth: 3,
        spanGaps: true,
      },
    ],
  };
  const gasChartJsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: "easeInOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        titleColor: "#000000",
        bodyColor: "#000000",
        padding: 12,
        boxPadding: 6,
        borderColor: "rgba(0, 0, 0, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems: any) =>
            `Tanggal: ${gasData[tooltipItems[0].dataIndex]?.date}`,
          label: (tooltipItem: any) =>
            `Avg Gas: ${tooltipItem.formattedValue} Gwei`,
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: "hsl(var(--foreground))",
          font: { size: 12, weight: "500" },
          maxRotation: 0,
          autoSkipPadding: 20,
          padding: 8,
        },
      },
      y: {
        border: { display: false },
        grid: { color: "hsl(var(--border))" },
        ticks: {
          color: "hsl(var(--foreground))",
          font: { size: 12, weight: "500" },
          padding: 8,
          callback: (value: any) => `${value} Gwei`,
        },
        beginAtZero: false,
      },
    },
  };

  // Konfigurasi Chart.js Congestion (Baru)
  const congestionChartJsData = {
    labels: congestionData.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "Avg Gas Limit Used (%)",
        data: congestionData.map((d) => d.avg_gas_limit_used_percent),
        backgroundColor: "#2563eb", // Warna berbeda (misal: chart-4)
        borderColor: "#2563e1",
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
      },
    ],
  };
  const congestionChartJsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800 },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        titleColor: "#000000",
        bodyColor: "#000000",
        padding: 12,
        boxPadding: 6,
        borderColor: "rgba(0, 0, 0, 0.1)",
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems: any) =>
            `Tanggal: ${congestionData[tooltipItems[0].dataIndex]?.date}`,
          label: (tooltipItem: any) =>
            `Avg Usage: ${tooltipItem.formattedValue}%`,
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: "hsl(var(--foreground))",
          font: { size: 12, weight: "500" },
          maxRotation: 0,
          autoSkipPadding: 15,
          padding: 5,
        },
      },
      y: {
        border: { display: false },
        grid: { color: "hsl(var(--border))" },
        ticks: {
          color: "hsl(var(--foreground))",
          font: { size: 12, weight: "500" },
          padding: 5,
          callback: (value: any) => `${value}%`,
        },
        beginAtZero: true,
        suggestedMax: 100,
      },
    },
  };
  // --- Akhir Konfigurasi Chart.js Congestion ---

  return (
    // Gunakan TooltipProvider di level ini
    <TooltipProvider>
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 max-w-7xl">
        {/* Layout Grid (2 kolom di md, 3 di lg) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
          {/* Card Transfer Harian (Span 2 di LG) */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-1 lg:col-span-2">
            <CardHeader className="border-b border-border/20">
              {" "}
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                Transfer Harian PYUSD
                <span className="text-sm font-normal text-muted-foreground">
                  (7 Hari Terakhir)
                </span>
              </CardTitle>
              <CardDescription>
                Jumlah dan volume transaksi transfer PYUSD harian.
              </CardDescription>
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-muted/50">
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-right">
                          Jumlah Transfer
                        </TableHead>
                        <TableHead className="text-right">
                          Total Volume (PYUSD)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferData.length > 0 ? (
                        transferData.map((row) => (
                          <TableRow
                            key={row.date}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <TableCell className="font-medium whitespace-nowrap">
                              {row.date}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {row.count.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {row.volume !== null
                                ? row.volume.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "0.00"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground h-24"
                          >
                            Tidak ada data transfer ditemukan.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kartu Average Gas Price */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Rata-Rata Gas Price (Ethereum)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Rata-rata harga gas harian (Gwei) di jaringan Ethereum.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Indikator biaya transaksi di jaringan Ethereum.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGasLoading && <ChartLoadingSkeleton />}
              {gasError && !isGasLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Memuat Data Gas</AlertTitle>
                  <AlertDescription>{gasError}</AlertDescription>
                </Alert>
              )}
              {!isGasLoading && !gasError && (
                <div className="h-72" style={{ position: "relative" }}>
                  <Line
                    data={gasChartJsData}
                    options={gasChartJsOptions as any}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Active Addresses */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Alamat Pengirim Aktif PYUSD
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Jumlah alamat unik yang mengirimkan PYUSD per hari.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Pengirim unik PYUSD (7 hari terakhir).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isActiveAddressLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              )}
              {activeAddressError && !isActiveAddressLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Memuat Alamat Aktif</AlertTitle>
                  <AlertDescription>{activeAddressError}</AlertDescription>
                </Alert>
              )}
              {!isActiveAddressLoading && !activeAddressError && (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/50">
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">
                        Jumlah Pengirim Unik
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAddressData.length > 0 ? (
                      activeAddressData.map((row) => (
                        <TableRow
                          key={row.date}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium">
                            {row.date}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {row.active_senders.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground h-24"
                        >
                          Tidak ada data alamat aktif ditemukan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Card BARU untuk Top Transfers (Span 2 di LG) */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Top 10 Transfer PYUSD
              </CardTitle>
              <CardDescription>
                Transfer PYUSD terbesar (7 hari terakhir).
              </CardDescription>
            </CardHeader>
            <CardContent>
            {isTopTransferLoading && (
                <div className="space-y-2">
                  {/* Skeleton rows */} <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" />
                </div>
              )}
               {topTransferError && !isTopTransferLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Memuat Top Transfer</AlertTitle>
                  <AlertDescription>{topTransferError}</AlertDescription>
                </Alert>
              )}
              {!isTopTransferLoading && !topTransferError && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-muted/50">
                        <TableHead className="w-[140px]">Timestamp</TableHead>
                        <TableHead>Dari</TableHead>
                        <TableHead>Ke</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead>Tx Hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topTransferData.length > 0 ? (
                        topTransferData.map((log) => (
                          <TableRow
                            key={`${log.txHash}-${log.logIndex}`}
                            className="hover:bg-muted/50 transition-colors"
                          >
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString("id-ID", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </TableCell>
                            <TableCell>
                              <EtherscanLink
                                type="address"
                                hash={log.fromAddress}
                                className="text-xs"
                              >
                                <HexDisplay
                                  value={log.fromAddress}
                                  isAddress={true}
                                />
                              </EtherscanLink>
                            </TableCell>
                            <TableCell>
                              <EtherscanLink
                                type="address"
                                hash={log.toAddress}
                                className="text-xs"
                              >
                                <HexDisplay
                                  value={log.toAddress}
                                  isAddress={true}
                                />
                              </EtherscanLink>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {log.formattedValue ?? log.rawValue}
                            </TableCell>
                            <TableCell>
                              <EtherscanLink
                                type="tx"
                                hash={log.txHash}
                                className="text-xs"
                              >
                                <HexDisplay
                                  value={log.txHash}
                                  isAddress={false}
                                />
                              </EtherscanLink>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground h-24"
                          >
                            Tidak ada data top transfer ditemukan.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card BARU untuk Congestion (Grafik Bar) */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Penggunaan Gas Limit (Congestion)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Persentase rata-rata dari gas limit transaksi yang
                      digunakan per hari. Nilai yang mendekati 100% dapat
                      menunjukkan potensi congestion di jaringan.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Rata-rata gas terpakai vs limit (7 hari terakhir).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCongestionLoading && <ChartLoadingSkeleton />}
              {congestionError && !isCongestionLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Memuat Congestion</AlertTitle>
                  <AlertDescription>{congestionError}</AlertDescription>
                </Alert>
              )}
              {!isCongestionLoading && !congestionError && (
                <div className="h-72" style={{ position: "relative" }}>
                  <Bar
                    data={congestionChartJsData}
                    options={congestionChartJsOptions as any}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default HistoricalDashboard;

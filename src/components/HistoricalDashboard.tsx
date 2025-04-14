// --- Updated File: src/components/HistoricalDashboard.tsx ---
// Description: Added Cards for Top Transfers and Congestion Chart.

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
// Import Chart.js and React wrapper + required elements (Line, Bar)
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Add BarElement
  Title as ChartJsTitle,
  Tooltip as ChartJsTooltip,
  Legend,
  Filler,
} from "chart.js";
// Import interfaces
import type { MergedHistoricalRow } from "@/types/analysis"; // Adjust path if needed

// Register Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Add BarElement
  ChartJsTitle,
  ChartJsTooltip,
  Legend,
  Filler
);

// --- Interfaces ---
interface GasPriceData {
  date: string;
  avg_gas_gwei: number | null;
}
interface ActiveAddressData {
  date: string;
  active_senders: number;
}
// Interface for Top Transfers
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
// Interface for Congestion
interface CongestionData {
  date: string;
  avg_gas_limit_used_percent: number | null;
}
// --- End Interfaces ---

// Helper components (same)
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
      title={`View on Etherscan (${type})`}
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
  // Existing state
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
  // NEW State for Top Transfers & Congestion
  const [topTransferData, setTopTransferData] = useState<
    TopTransferFormattedRow[]
  >([]);
  const [isTopTransferLoading, setIsTopTransferLoading] =
    useState<boolean>(true);
  const [topTransferError, setTopTransferError] = useState<string | null>(null);
  const [congestionData, setCongestionData] = useState<CongestionData[]>([]);
  const [isCongestionLoading, setIsCongestionLoading] = useState<boolean>(true);
  const [congestionError, setCongestionError] = useState<string | null>(null);

  // Generic fetch function (same)
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
        let errorMessage = `Failed (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) errorMessage = errorJson.message;
        } catch (parseError) {
          errorMessage = errorText || `Failed (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      if (result.type !== expectedType || !result.data) {
        throw new Error(`Invalid ${expectedType} data format.`);
      }
      setData(result.data);
    } catch (err: any) {
      console.error(`Error fetching ${url}:`, err);
      setError(err.message || `Failed to load ${expectedType} data.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data (add fetch for top_transfers and congestion)
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

  // Loading Skeleton Components
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

  // Chart.js Gas Price Configuration (same)
  const gasChartJsData = {
    labels: gasData.map((d) => d.date.slice(5)), // Show only MM-DD
    datasets: [
      {
        label: "Avg Gas (Gwei)",
        data: gasData.map((d) => d.avg_gas_gwei),
        borderColor: "#2563eb", // blue-600
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, "rgba(37, 99, 235, 0.5)"); // blue-600 with 50% opacity
          gradient.addColorStop(1, "rgba(37, 99, 235, 0.0)"); // Transparent
          return gradient;
        },
        tension: 0.4, // Smooth curves
        fill: true, // Fill area under the line
        pointBackgroundColor: "#2563eb", // blue-600
        pointBorderColor: "#ffffff", // white
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#1e40af", // blue-800
        pointHoverBorderColor: "#ffffff", // white
        borderWidth: 3,
        spanGaps: true, // Connect lines over null data points
      },
    ],
  };
  const gasChartJsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: "easeInOutQuart" },
    interaction: { mode: "index", intersect: false }, // Show tooltip for all datasets at that index
    plugins: {
      legend: { display: false }, // Hide legend
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(255, 255, 255, 0.95)", // Semi-transparent white
        titleColor: "#000000", // Black title
        bodyColor: "#000000", // Black body
        padding: 12,
        boxPadding: 6,
        borderColor: "rgba(0, 0, 0, 0.1)", // Light gray border
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems: any) =>
            `Date: ${gasData[tooltipItems[0].dataIndex]?.date}`, // Full date in title
          label: (tooltipItem: any) =>
            `Avg Gas: ${tooltipItem.formattedValue} Gwei`,
        },
      },
    },
    scales: {
      x: {
        border: { display: false }, // Hide X-axis line
        grid: { display: false }, // Hide X-axis grid lines
        ticks: {
          color: "hsl(var(--foreground))", // Use theme color
          font: { size: 12, weight: "500" },
          maxRotation: 0, // Prevent label rotation
          autoSkipPadding: 20, // Add padding for auto-skipping labels
          padding: 8,
        },
      },
      y: {
        border: { display: false }, // Hide Y-axis line
        grid: { color: "hsl(var(--border))" }, // Use theme border color for grid lines
        ticks: {
          color: "hsl(var(--foreground))", // Use theme color
          font: { size: 12, weight: "500" },
          padding: 8,
          callback: (value: any) => `${value} Gwei`, // Add 'Gwei' unit
        },
        beginAtZero: false, // Start axis near the minimum value
      },
    },
  };

  // Chart.js Congestion Configuration (New)
  const congestionChartJsData = {
    labels: congestionData.map((d) => d.date.slice(5)), // Show only MM-DD
    datasets: [
      {
        label: "Avg Gas Limit Used (%)",
        data: congestionData.map((d) => d.avg_gas_limit_used_percent),
        backgroundColor: "#2563eb", // blue-600 (or use a different color like chart-4 if defined)
        borderColor: "#2563eb", // blue-600
        borderWidth: 1,
        borderRadius: 4, // Rounded corners for bars
        barPercentage: 0.6, // Width of the bar relative to the available space
        categoryPercentage: 0.7, // Width of the category space for the bar
      },
    ],
  };
  const congestionChartJsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800 }, // Slightly faster animation for bars
    plugins: {
      legend: { display: false }, // Hide legend
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(255, 255, 255, 0.95)", // Semi-transparent white
        titleColor: "#000000", // Black title
        bodyColor: "#000000", // Black body
        padding: 12,
        boxPadding: 6,
        borderColor: "rgba(0, 0, 0, 0.1)", // Light gray border
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems: any) =>
            `Date: ${congestionData[tooltipItems[0].dataIndex]?.date}`, // Full date in title
          label: (tooltipItem: any) =>
            `Avg Usage: ${tooltipItem.formattedValue}%`, // Add '%' unit
        },
      },
    },
    scales: {
      x: {
        border: { display: false }, // Hide X-axis line
        grid: { display: false }, // Hide X-axis grid lines
        ticks: {
          color: "hsl(var(--foreground))", // Use theme color
          font: { size: 12, weight: "500" },
          maxRotation: 0, // Prevent label rotation
          autoSkipPadding: 15, // Adjust padding for bar chart labels
          padding: 5,
        },
      },
      y: {
        border: { display: false }, // Hide Y-axis line
        grid: { color: "hsl(var(--border))" }, // Use theme border color for grid lines
        ticks: {
          color: "hsl(var(--foreground))", // Use theme color
          font: { size: 12, weight: "500" },
          padding: 5,
          callback: (value: any) => `${value}%`, // Add '%' unit
        },
        beginAtZero: true, // Start Y-axis at 0
        suggestedMax: 100, // Suggest Y-axis goes up to 100%
      },
    },
  };
  // --- End Chart.js Congestion Configuration ---

  return (
    // Use TooltipProvider at this level
    <TooltipProvider>
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 max-w-7xl">
        {/* Grid Layout (2 columns on md, 3 on lg) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
          {/* Daily Transfer Card (Span 2 on LG) */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-1 lg:col-span-2">
            <CardHeader className="border-b border-border/20">
              {" "}
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                Daily PYUSD Transfers
                <span className="text-sm font-normal text-muted-foreground">
                  (Last 7 Days)
                </span>
              </CardTitle>
              <CardDescription>
                Daily count and volume of PYUSD transfer transactions.
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
                  <AlertTitle>Error Loading Transfer Data</AlertTitle>
                  <AlertDescription>{transferError}</AlertDescription>
                </Alert>
              )}
              {!isTransferLoading && !transferError && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">
                          Transfer Count
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
                            No transfer data found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Average Gas Price Card */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Average Gas Price (Ethereum)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Average daily gas price (Gwei) on the Ethereum network.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Indicator of transaction costs on the Ethereum network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGasLoading && <ChartLoadingSkeleton />}
              {gasError && !isGasLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Gas Data</AlertTitle>
                  <AlertDescription>{gasError}</AlertDescription>
                </Alert>
              )}
              {!isGasLoading && !gasError && (
                <div className="h-72" style={{ position: "relative" }}>
                  <Line
                    data={gasChartJsData}
                    options={gasChartJsOptions as any} // Cast to any to avoid deep type issues
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Addresses Card */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Active PYUSD Senders
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of unique addresses sending PYUSD per day.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Unique PYUSD senders (last 7 days).
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
                  <AlertTitle>Error Loading Active Addresses</AlertTitle>
                  <AlertDescription>{activeAddressError}</AlertDescription>
                </Alert>
              )}
              {!isActiveAddressLoading && !activeAddressError && (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">
                        Unique Senders
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
                          No active address data found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* NEW Card for Top Transfers (Span 2 on LG) */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 md:col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Top 10 PYUSD Transfers
              </CardTitle>
              <CardDescription>
                Largest PYUSD transfers (last 7 days).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isTopTransferLoading && (
                <div className="space-y-2">
                  {/* Skeleton rows */} <Skeleton className="h-10 w-full" />{" "}
                  <Skeleton className="h-10 w-full" />{" "}
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {topTransferError && !isTopTransferLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Top Transfers</AlertTitle>
                  <AlertDescription>{topTransferError}</AlertDescription>
                </Alert>
              )}
              {!isTopTransferLoading && !topTransferError && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-muted/50">
                        <TableHead className="w-[140px]">Timestamp</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
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
                              {new Date(log.timestamp).toLocaleString("en-US", {
                                // Use en-US locale for consistency
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
                            No top transfer data found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NEW Card for Congestion (Bar Chart) */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Gas Limit Usage (Congestion)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Average percentage of the transaction gas limit used per
                      day. Values approaching 100% can indicate potential
                      network congestion.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Average gas used vs. limit (last 7 days).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCongestionLoading && <ChartLoadingSkeleton />}
              {congestionError && !isCongestionLoading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Congestion Data</AlertTitle>
                  <AlertDescription>{congestionError}</AlertDescription>
                </Alert>
              )}
              {!isCongestionLoading && !congestionError && (
                <div className="h-72" style={{ position: "relative" }}>
                  <Bar
                    data={congestionChartJsData}
                    options={congestionChartJsOptions as any} // Cast to any
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

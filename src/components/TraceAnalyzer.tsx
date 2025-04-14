"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Terminal,
  AlertCircle,
  CheckCircle2,
  LinkIcon,
  HelpCircle,
  Repeat2,
} from "lucide-react";
import { formatUnits } from "viem";
import { toast } from "sonner";
import type {
  AnalysisResult,
  AnalysisSummary,
  ExternalCallItem,
  StorageWriteItem,
  EventItem,
} from "@/types/analysis";

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
      {children || hash} <LinkIcon className="h-3 w-3" />
    </a>
  );
};

const HexDisplay: React.FC<{ value: string; prefix?: string }> = ({
  value,
  prefix = "0x",
}) => {
  if (
    !value ||
    typeof value !== "string" ||
    !value.startsWith("0x") ||
    value.length <= 10
  ) {
    return <span className="font-mono break-all">{value || "N/A"}</span>;
  }
  const truncated = `${prefix}${value.substring(2, 6)}...${value.substring(
    value.length - 4
  )}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono cursor-help">{truncated}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <p className="break-all">{value}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const TraceAnalyzer: React.FC = () => {
  const [txHash, setTxHash] = useState<string>("");
  const [analyzedTxHash, setAnalyzedTxHash] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const currentTxHash = txHash;
    if (
      !currentTxHash ||
      !currentTxHash.startsWith("0x") ||
      currentTxHash.length !== 66
    ) {
      setError("Masukkan Transaction Hash Ethereum yang valid (0x...).");
      toast.error("Input tidak valid!", {
        description: "Masukkan Transaction Hash Ethereum yang valid (0x...).",
      });
      setResult(null);
      setAnalyzedTxHash(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedTxHash(null);
    const loadingToastId = toast.loading("Menganalisis transaksi...");
    try {
      const response = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: currentTxHash }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(
          data.message || `Gagal mengambil data: ${response.statusText}`,
          { id: loadingToastId }
        );
        throw new Error(
          data.message || `Gagal mengambil data: ${response.statusText}`
        );
      }
      if (!data.summary) {
        toast.error("Format respons dari server tidak valid.", {
          id: loadingToastId,
        });
        throw new Error("Format respons dari server tidak valid.");
      }
      setResult(data);
      setAnalyzedTxHash(currentTxHash);
      toast.success("Analisis selesai!", { id: loadingToastId });
    } catch (err: any) {
      console.error("Error fetching trace:", err);
      setError(err.message || "Terjadi kesalahan saat menghubungi server.");
      toast.error(err.message || "Gagal menganalisis.", { id: loadingToastId });
      setResult(null);
      setAnalyzedTxHash(null);
    } finally {
      setIsLoading(false);
    }
  };

  const LoadingSkeleton = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );

  const renderObjectList = (
    idPrefix: string,
    label: string,
    items: Array<any>,
    renderItem: (item: any, index: number) => React.ReactNode
  ) =>
    items.length > 0 && (
      <AccordionItem value={`item-${idPrefix}`}>
        <AccordionTrigger>
          {label} ({items.length})
        </AccordionTrigger>
        <AccordionContent>
          <ul className="space-y-2 text-xs max-h-60 overflow-y-auto pr-2">
            {items.map((item, index) => renderItem(item, index))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    );

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Analisis Trace Transaksi</CardTitle>
          <CardDescription>
            Masukkan hash transaksi untuk melihat detail eksekusinya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Masukkan Transaction Hash (contoh: 0x...)"
              className="flex-grow text-sm sm:text-base"
              disabled={isLoading}
            />
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !txHash}
              className="text-sm sm:text-base"
            >
              {isLoading ? "Menganalisis..." : "Analyze"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="min-h-[200px]">
        {isLoading && <LoadingSkeleton />}
        {result && result.summary && !error && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Hasil Analisis Trace</span>
                {analyzedTxHash && (
                  <EtherscanLink
                    type="tx"
                    hash={analyzedTxHash}
                    className="text-xs font-normal"
                  >
                    Lihat Transaksi
                  </EtherscanLink>
                )}
              </CardTitle>
              <Alert
                variant={result.summary.failed ? "destructive" : "default"}
                className="mt-2"
              >
                {result.summary.failed ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <AlertTitle>
                  {result.summary.failed
                    ? "Transaksi Gagal"
                    : "Transaksi Sukses"}
                </AlertTitle>
                <AlertDescription className="text-xs break-all">
                  Return Value:
                  <HexDisplay value={result.summary.returnValue || "N/A"} />
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent className="space-y-4 text-sm sm:text-base">
              <div>
                <p>
                  <strong className="font-semibold">
                    Total Gas Digunakan:
                  </strong>
                  {result.summary.totalGasUsed.toLocaleString()}
                </p>
                <p className="inline-flex items-center gap-1">
                  <strong className="font-semibold">
                    Kedalaman Panggilan Maks.:
                  </strong>
                  {result.summary.maxDepth}
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jumlah maksimum panggilan internal bersarang.</p>
                    </TooltipContent>
                  </Tooltip>
                </p>
              </div>
              {Object.keys(result.summary.opCodeCounts).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Distribusi Opcode (Top 10)
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opcode</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(result.summary.opCodeCounts)
                        .sort(
                          ([, countA], [, countB]) =>
                            Number(countB) - Number(countA)
                        )
                        .slice(0, 10)
                        .map(([op, count]) => (
                          <TableRow key={op}>
                            <TableCell className="font-medium">{op}</TableCell>
                            <TableCell className="text-right">
                              {Number(count).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <Accordion type="single" collapsible className="w-full">
                {renderObjectList(
                  "external-calls",
                  "Panggilan Eksternal/Internal",
                  result.summary.externalCalls,
                  (call: ExternalCallItem, index) => (
                    <li
                      key={`call-${index}`}
                      className={`p-2 rounded border space-y-1 dark:text-gray-900 ${
                        call.isSwapRelated
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-100"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="break-all flex items-center gap-1">
                          {call.isSwapRelated && (
                            <Repeat2 className="h-3 w-3 text-blue-600" />
                          )}
                          <strong>Target:</strong>
                          {call.targetName ? (
                            <>
                              <span className="font-semibold">
                                {call.targetName}
                              </span>
                            </>
                          ) : (
                            <HexDisplay
                              value={call.target || "(Alamat tidak valid)"}
                            />
                          )}
                        </span>
                        {call.target &&
                          call.target.length === 42 &&
                          call.target.startsWith("0x") && (
                            <EtherscanLink
                              type="address"
                              hash={call.target}
                              className="text-xs"
                            >
                              Lihat Alamat
                            </EtherscanLink>
                          )}
                      </div>
                      {call.functionName && (
                        <p>
                          <strong>Fungsi:</strong>
                          <span className="font-mono">{call.functionName}</span>
                        </p>
                      )}
                      {call.args && Object.keys(call.args).length > 0 && (
                        <div>
                          <p>
                            <strong>Argumen (Perkiraan):</strong>
                          </p>
                          <ul className="list-disc list-inside pl-4">
                            {Object.entries(call.args).map(([key, value]) => (
                              <li key={key} className="break-all">
                                {key}:
                                {(key === "to" ||
                                  key === "from" ||
                                  key === "spender") &&
                                typeof value === "string" &&
                                value.startsWith("0x") ? (
                                  <EtherscanLink
                                    type="address"
                                    hash={value}
                                    className="text-xs"
                                  >
                                    <HexDisplay value={value} />
                                  </EtherscanLink>
                                ) : key === "value" &&
                                  call.functionName ===
                                    "transfer(address,uint256)" &&
                                  (call.targetName === "PYUSD Contract" ||
                                    call.targetName === "WETH Contract") ? (
                                  <span>
                                    {value}
                                    {call.targetName === "PYUSD Contract"
                                      ? " PYUSD"
                                      : " WETH"}
                                  </span>
                                ) : typeof value === "string" &&
                                  value.startsWith("0x") ? (
                                  <HexDisplay value={value} />
                                ) : (
                                  String(value)
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p>
                        <strong>Gas Disediakan:</strong>
                        {parseInt(call.gas, 16).toLocaleString()}
                      </p>
                      <p>
                        <strong>Gas Digunakan (Internal):</strong>
                        {call.gasUsed?.toLocaleString() ?? "N/A (Perkiraan)"}
                      </p>
                      <p>
                        <strong>Value:</strong>
                        {parseInt(call.value, 16).toLocaleString()} Wei
                      </p>
                    </li>
                  )
                )}
                {renderObjectList(
                  "storage-writes",
                  "Penulisan Storage",
                  result.summary.storageWrites,
                  (write: StorageWriteItem, index) => (
                    <li
                      key={`sstore-${index}`}
                      className="p-2 bg-gray-100 rounded border space-y-1 dark:text-gray-900"
                    >
                      <p className="break-all">
                        <strong>Slot:</strong> <HexDisplay value={write.slot} />
                      </p>
                      <p className="break-all">
                        <strong>Value:</strong>
                        <HexDisplay value={write.value} />
                      </p>
                    </li>
                  )
                )}
                {renderObjectList(
                  "events",
                  "Events",
                  result.summary.events,
                  (eventItem: EventItem, index) => (
                    <li
                      key={`event-${index}`}
                      className="p-2 bg-gray-100 rounded border space-y-1 dark:text-gray-900"
                    >
                      {"eventName" in eventItem ? (
                        <>
                          <p>
                            <strong>Event:</strong> {eventItem.eventName}
                            {eventItem.tokenSymbol &&
                              ` (${eventItem.tokenSymbol})`}
                          </p>
                          <p className="break-all">
                            <strong>Args:</strong>
                          </p>
                          <ul className="list-disc list-inside pl-4">
                            {Object.entries(eventItem.args).map(
                              ([key, value]) => (
                                <li key={key} className="break-all">
                                  {key}:
                                  {(key === "from" || key === "to") &&
                                  typeof value === "string" &&
                                  value.startsWith("0x") ? (
                                    <EtherscanLink
                                      type="address"
                                      hash={value}
                                      className="text-xs"
                                    >
                                      {value}
                                    </EtherscanLink>
                                  ) : (
                                    String(value)
                                  )}
                                </li>
                              )
                            )}
                          </ul>
                        </>
                      ) : (
                        <>
                          <p className="break-all">
                            <strong>Topics:</strong>
                          </p>
                          <ul className="list-disc list-inside pl-4">
                            {eventItem.raw.topics.map((topic, idx) => (
                              <li key={idx}>
                                <HexDisplay
                                  value={topic}
                                  prefix={`Topic ${idx}`}
                                />
                              </li>
                            ))}
                          </ul>
                          <p className="break-all">
                            <strong>Data:</strong>
                            <HexDisplay value={eventItem.raw.data} />
                          </p>
                        </>
                      )}
                    </li>
                  )
                )}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
export default TraceAnalyzer;

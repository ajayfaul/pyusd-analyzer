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
  AlertCircle,
  CheckCircle2,
  LinkIcon,
  HelpCircle,
  Repeat2,
} from "lucide-react"; // Hapus Terminal, Network
// import { formatUnits } from 'viem'; // Hapus formatUnits jika tidak dipakai langsung
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type {
  AnalysisResult,
  ExternalCallItem,
  StorageWriteItem,
  EventItem,
} from "@/types/analysis"; // Hapus AnalysisSummary jika tidak dipakai

// --- Helper Components ---
const EtherscanLink: React.FC<{
  type: "tx" | "address";
  hash: string;
  children?: React.ReactNode;
  className?: string;
  network?: string;
}> = ({ type, hash, children, className, network = "mainnet" }) => {
  const baseUrl =
    network === "sepolia"
      ? "https://sepolia.etherscan.io"
      : "https://etherscan.io";
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
// --- End Helper Components ---

const TraceAnalyzer: React.FC = () => {
  const [txHash, setTxHash] = useState<string>("");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("mainnet");
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
      const errorMsg =
        "Please enter a valid Ethereum Transaction Hash (0x...).";
      setError(errorMsg);
      toast.error("Invalid Input!", { description: errorMsg });
      setResult(null);
      setAnalyzedTxHash(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedTxHash(null);
    const loadingToastId = toast.loading(
      `Analyzing transaction on ${selectedNetwork}...`
    );
    let response: Response | null = null;
    try {
      response = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: currentTxHash,
          network: selectedNetwork,
        }),
      });
      if (!response.ok) {
        let errorMsg = `Failed to fetch data (${response.status} ${response.statusText})`;
        let errorDesc = "Check the console for more details.";
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMsg = errorData.message;
            errorDesc = `Status: ${response.status}`;
          }
        } catch {
          try {
            const errorText = await response.text();
            if (errorText) errorMsg = errorText;
          } catch {
            /* Ignore */
          }
        }
        if (response.status === 404) {
          errorMsg = `Transaction not found on ${selectedNetwork}.`;
          errorDesc = "Please check the hash and selected network.";
          toast.error(errorMsg, { id: loadingToastId, description: errorDesc });
          setError(`${errorMsg} ${errorDesc}`);
        } else {
          toast.error(errorMsg, { id: loadingToastId, description: errorDesc });
          setError(errorMsg);
        }
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      if (!data.summary) {
        toast.error("Invalid response format from server.", {
          id: loadingToastId,
        });
        throw new Error("Invalid response format from server.");
      }
      setResult(data);
      setAnalyzedTxHash(currentTxHash);
      toast.success(`Analysis on ${selectedNetwork} complete!`, {
        id: loadingToastId,
      });
    } catch (err: unknown) {
      console.error("Error during fetch/analysis:", err);
      const message =
        err instanceof Error ? err.message : "Failed to analyze transaction.";
      if (response?.status !== 404) {
        setError(message);
        toast.error("Analysis Failed", {
          id: loadingToastId,
          description: message,
        });
      }
      setResult(null);
      setAnalyzedTxHash(null);
    } finally {
      if (response?.status !== 404) {
        setIsLoading(false);
      }
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
    items: Array<unknown>,
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
    ); // FIX: items: Array<unknown>

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="shadow-md">
        {" "}
        <CardHeader>
          {" "}
          <CardTitle>Transaction Trace Analyzer</CardTitle>{" "}
          <CardDescription>
            Enter a transaction hash and select the network to view execution
            details.
          </CardDescription>{" "}
        </CardHeader>{" "}
        <CardContent>
          {" "}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {" "}
            <Input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Enter Transaction Hash (e.g., 0x...)"
              className="flex-grow text-sm sm:text-base"
              disabled={isLoading}
            />{" "}
            <Select
              value={selectedNetwork}
              onValueChange={setSelectedNetwork}
              disabled={isLoading}
            >
              {" "}
              <SelectTrigger className="w-full sm:w-[180px]">
                {" "}
                <SelectValue placeholder="Select Network" />{" "}
              </SelectTrigger>{" "}
              <SelectContent>
                {" "}
                <SelectItem value="mainnet">Mainnet</SelectItem>{" "}
                <SelectItem value="sepolia">Sepolia</SelectItem>{" "}
              </SelectContent>{" "}
            </Select>{" "}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !txHash}
              className="text-sm sm:text-base"
            >
              {" "}
              {isLoading ? "Analyzing..." : "Analyze"}{" "}
            </Button>{" "}
          </div>{" "}
        </CardContent>{" "}
      </Card>

      {/* Results Area */}
      <div className="min-h-[200px]">
        {isLoading && <LoadingSkeleton />}
        {error && !isLoading && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            {" "}
            <AlertCircle className="h-4 w-4" />{" "}
            <AlertTitle>Analysis Error</AlertTitle>{" "}
            <AlertDescription>{error}</AlertDescription>{" "}
          </Alert>
        )}
        {result && result.summary && !error && !isLoading && (
          <Card>
            <CardHeader>
              {" "}
              <CardTitle className="flex items-center justify-between">
                {" "}
                <div className="flex items-center gap-2">
                  {" "}
                  <span>Trace Analysis Results</span>{" "}
                  <Badge
                    variant={
                      result.summary.network === "sepolia"
                        ? "secondary"
                        : "default"
                    }
                  >
                    {" "}
                    {result.summary.network === "sepolia"
                      ? "Sepolia"
                      : "Mainnet"}{" "}
                  </Badge>{" "}
                </div>{" "}
                {analyzedTxHash && (
                  <EtherscanLink
                    type="tx"
                    hash={analyzedTxHash}
                    network={result.summary.network}
                    className="text-xs font-normal"
                  >
                    View Transaction
                  </EtherscanLink>
                )}{" "}
              </CardTitle>{" "}
              <Alert
                variant={result.summary.failed ? "destructive" : "default"}
                className="mt-2"
              >
                {" "}
                {result.summary.failed ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                <AlertTitle>
                  {result.summary.failed
                    ? "Transaction Failed"
                    : "Transaction Succeeded"}
                </AlertTitle>{" "}
                <AlertDescription className="text-xs break-all">
                  Return Value:{" "}
                  <HexDisplay value={result.summary.returnValue || "N/A"} />
                </AlertDescription>{" "}
              </Alert>{" "}
            </CardHeader>
            <CardContent className="space-y-4 text-sm sm:text-base">
              <div>
                {" "}
                <p>
                  <strong className="font-semibold">Total Gas Used:</strong>{" "}
                  {result.summary.totalGasUsed.toLocaleString()}
                </p>{" "}
                <p className="inline-flex items-center gap-1">
                  {" "}
                  <strong className="font-semibold">
                    Max Call Depth:
                  </strong>{" "}
                  {result.summary.maxDepth}{" "}
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Maximum nested internal call depth.</p>
                    </TooltipContent>
                  </Tooltip>{" "}
                </p>{" "}
              </div>
              {Object.keys(result.summary.opCodeCounts).length > 0 && (
                <div>
                  {" "}
                  <h3 className="text-lg font-semibold mb-2">
                    Opcode Distribution (Top 10)
                  </h3>{" "}
                  <Table>
                    {" "}
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opcode</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>{" "}
                    <TableBody>
                      {" "}
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
                        ))}{" "}
                    </TableBody>{" "}
                  </Table>{" "}
                </div>
              )}
              <Accordion type="single" collapsible className="w-full">
                {renderObjectList(
                  "external-calls",
                  "External/Internal Calls",
                  result.summary.externalCalls,
                  (call: ExternalCallItem, index) => (
                    <li
                      key={`call-${index}`}
                      className={`p-2 rounded border space-y-1 ${
                        call.isSwapRelated
                          ? "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700"
                          : "bg-gray-100 dark:bg-gray-800/50"
                      }`}
                    >
                      {" "}
                      <div className="flex justify-between items-center">
                        {" "}
                        <span className="break-all flex items-center gap-1">
                          {" "}
                          {call.isSwapRelated && (
                            <Repeat2 className="h-3 w-3 text-blue-600" />
                          )}{" "}
                          <strong>Target:</strong>{" "}
                          {call.targetName ? (
                            <span className="font-semibold">
                              {call.targetName}
                            </span>
                          ) : (
                            <HexDisplay
                              value={call.target || "(Invalid Address)"}
                              isAddress={true}
                            />
                          )}{" "}
                        </span>{" "}
                        {call.target &&
                          call.target.length === 42 &&
                          call.target.startsWith("0x") && (
                            <EtherscanLink
                              type="address"
                              hash={call.target}
                              network={result.summary.network}
                              className="text-xs"
                            >
                              View Address
                            </EtherscanLink>
                          )}{" "}
                      </div>{" "}
                      {call.functionName && (
                        <p>
                          <strong>Function:</strong>{" "}
                          <span className="font-mono">{call.functionName}</span>
                        </p>
                      )}{" "}
                      {call.args && Object.keys(call.args).length > 0 && (
                        <div>
                          {" "}
                          <p>
                            <strong>Arguments (Estimated):</strong>
                          </p>{" "}
                          <ul className="list-disc list-inside pl-4">
                            {" "}
                            {Object.entries(call.args).map(([key, value]) => (
                              <li key={key} className="break-all">
                                {key}:{" "}
                                {(key === "to" ||
                                  key === "from" ||
                                  key === "spender") &&
                                typeof value === "string" &&
                                value.startsWith("0x") ? (
                                  <EtherscanLink
                                    type="address"
                                    hash={value}
                                    network={result.summary.network}
                                    className="text-xs"
                                  >
                                    <HexDisplay
                                      value={value}
                                      isAddress={true}
                                    />
                                  </EtherscanLink>
                                ) : key === "value" &&
                                  call.functionName ===
                                    "transfer(address,uint256)" &&
                                  (call.targetName?.startsWith(
                                    "PYUSD Contract"
                                  ) ||
                                    call.targetName?.startsWith(
                                      "WETH Contract"
                                    )) ? (
                                  <span>
                                    {" "}
                                    {/* FIX: Konversi value (unknown) ke string */}{" "}
                                    {String(value)}{" "}
                                    {call.targetName?.split(" ")[0]}{" "}
                                  </span>
                                ) : typeof value === "string" &&
                                  value.startsWith("0x") ? (
                                  <HexDisplay value={value} />
                                ) : (
                                  String(value)
                                )}{" "}
                              </li>
                            ))}{" "}
                          </ul>{" "}
                        </div>
                      )}{" "}
                      <p>
                        <strong>Gas Provided:</strong>{" "}
                        {parseInt(call.gas, 16).toLocaleString()}
                      </p>{" "}
                      <p>
                        <strong>Gas Used (Internal Est.):</strong>{" "}
                        {call.gasUsed?.toLocaleString() ?? "N/A (Est.)"}
                      </p>{" "}
                      <p>
                        <strong>Value:</strong>{" "}
                        {parseInt(call.value, 16).toLocaleString()} Wei
                      </p>{" "}
                    </li>
                  )
                )}
                {renderObjectList(
                  "storage-writes",
                  "Storage Writes",
                  result.summary.storageWrites,
                  (write: StorageWriteItem, index) => (
                    <li
                      key={`sstore-${index}`}
                      className="p-2 bg-gray-100 dark:bg-gray-800/50 rounded border space-y-1"
                    >
                      {" "}
                      <p className="break-all">
                        <strong>Slot:</strong> <HexDisplay value={write.slot} />
                      </p>{" "}
                      <p className="break-all">
                        <strong>Value:</strong>{" "}
                        <HexDisplay value={write.value} />
                      </p>{" "}
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
                      className="p-2 bg-gray-100 dark:bg-gray-800/50 rounded border space-y-1"
                    >
                      {" "}
                      {"eventName" in eventItem ? (
                        <>
                          {" "}
                          <p>
                            <strong>Event:</strong> {eventItem.eventName}{" "}
                            {eventItem.tokenSymbol &&
                              `(${eventItem.tokenSymbol})`}
                          </p>{" "}
                          <p className="break-all">
                            <strong>Args:</strong>
                          </p>{" "}
                          <ul className="list-disc list-inside pl-4">
                            {" "}
                            {Object.entries(eventItem.args).map(
                              ([key, value]) => (
                                <li key={key} className="break-all">
                                  {key}:{" "}
                                  {(key === "from" || key === "to") &&
                                  typeof value === "string" &&
                                  value.startsWith("0x") ? (
                                    <EtherscanLink
                                      type="address"
                                      hash={value}
                                      network={result.summary.network}
                                      className="text-xs"
                                    >
                                      {value}
                                    </EtherscanLink>
                                  ) : (
                                    String(value)
                                  )}{" "}
                                </li>
                              )
                            )}{" "}
                          </ul>{" "}
                        </>
                      ) : (
                        <>
                          {" "}
                          <p className="break-all">
                            <strong>Topics:</strong>
                          </p>{" "}
                          <ul className="list-disc list-inside pl-4">
                            {" "}
                            {eventItem.raw.topics.map((topic, idx) => (
                              <li key={idx}>
                                <HexDisplay value={topic} prefix={`T${idx}`} />
                              </li>
                            ))}{" "}
                          </ul>{" "}
                          <p className="break-all">
                            <strong>Data:</strong>{" "}
                            <HexDisplay value={eventItem.raw.data} />
                          </p>{" "}
                        </>
                      )}{" "}
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

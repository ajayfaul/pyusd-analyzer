// Deskripsi: Menambahkan komentar English dan menerjemahkan teks UI.

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
  Network,
} from "lucide-react";
import { formatUnits } from "viem";
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
  AnalysisSummary,
  ExternalCallItem,
  StorageWriteItem,
  EventItem,
} from "@/types/analysis";

// --- Helper Components ---

/**
 * Renders a link to Etherscan (or Sepolia Etherscan) for a given address or transaction hash.
 */
const EtherscanLink: React.FC<{
  type: "tx" | "address";
  hash: string;
  children?: React.ReactNode;
  className?: string;
  network?: string; // Network context ('mainnet' or 'sepolia')
}> = ({ type, hash, children, className, network = "mainnet" }) => {
  const baseUrl =
    network === "sepolia"
      ? "[https://sepolia.etherscan.io](https://sepolia.etherscan.io)"
      : "[https://etherscan.io](https://etherscan.io)";
  const url = `${baseUrl}/${type}/${hash}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-600 hover:underline inline-flex items-center gap-1 ${className}`}
      title={`View on Etherscan (${type})`}
    >
      {children || hash}
      <LinkIcon className="h-3 w-3" />
    </a>
  );
};

/**
 * Renders a hex string, truncating it with a tooltip showing the full value.
 */
const HexDisplay: React.FC<{
  value: string;
  prefix?: string;
  isAddress?: boolean; // Slightly longer truncation for addresses
}> = ({ value, prefix = "0x", isAddress = false }) => {
  if (!value || typeof value !== "string" || !value.startsWith("0x")) {
    return <span className="font-mono break-all">{value || "N/A"}</span>;
  }
  // Adjust truncation length
  const maxLength = isAddress ? 14 : 10; // e.g., 0x1234...abcd (14) or 0x123...abcd (10)
  const endLength = 4;
  const startLength = isAddress ? 5 : 3; // Adjust start length accordingly
  if (value.length <= maxLength) {
    return <span className="font-mono break-all">{value}</span>;
  }
  const truncated = `${prefix}${value.substring(
    2,
    2 + startLength
  )}...${value.substring(value.length - endLength)}`;
  return (
    // TooltipProvider should be higher up in the tree (e.g., page.tsx)
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

/**
 * Main component for the Transaction Trace Analyzer feature.
 */
const TraceAnalyzer: React.FC = () => {
  // State hooks
  const [txHash, setTxHash] = useState<string>(""); // Input transaction hash
  const [selectedNetwork, setSelectedNetwork] = useState<string>("mainnet"); // Selected network ('mainnet' or 'sepolia')
  const [analyzedTxHash, setAnalyzedTxHash] = useState<string | null>(null); // Hash of the analyzed transaction
  const [result, setResult] = useState<AnalysisResult | null>(null); // Analysis result from API
  const [isLoading, setIsLoading] = useState<boolean>(false); // Loading state
  const [error, setError] = useState<string | null>(null); // Error message for UI display

  /**
   * Handles the analysis request when the button is clicked.
   * Fetches trace data from the backend API.
   */
  const handleAnalyze = async () => {
    const currentTxHash = txHash;
    // Basic input validation
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
    // Reset state and show loading toast
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedTxHash(null);
    const loadingToastId = toast.loading(
      `Analyzing transaction on ${selectedNetwork}...`
    );

    let response: Response | null = null; // Store response for status check
    try {
      // Call the backend API
      response = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: currentTxHash,
          network: selectedNetwork,
        }), // Send network choice
      });

      // Handle non-OK responses (including 404)
      if (!response.ok) {
        let errorMsg = `Failed to fetch data (${response.status} ${response.statusText})`;
        let errorDesc = "Check the console for more details.";
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMsg = errorData.message; // Use message from backend
            errorDesc = `Status: ${response.status}`;
          }
        } catch (e) {
          try {
            const errorText = await response.text();
            if (errorText) errorMsg = errorText;
          } catch (textErr) {
            /* Ignore */
          }
        }

        // Specific handling for 404 Not Found
        if (response.status === 404) {
          errorMsg = `Transaction not found on ${selectedNetwork}.`;
          errorDesc = "Please check the hash and selected network.";
          toast.error(errorMsg, { id: loadingToastId, description: errorDesc });
          setError(`${errorMsg} ${errorDesc}`); // Set UI error
        } else {
          // Handle other errors (e.g., 500)
          toast.error(errorMsg, { id: loadingToastId, description: errorDesc });
          setError(errorMsg); // Set UI error
        }
        setIsLoading(false); // Ensure loading stops on handled error
        return; // Stop further processing
      }

      // Process successful response
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
    } catch (err: any) {
      // Catch network errors or manually thrown errors
      console.error("Error during fetch/analysis:", err);
      // Avoid double-reporting 404 errors
      if (response?.status !== 404) {
        const finalErrorMsg = err.message || "Failed to analyze transaction.";
        setError(finalErrorMsg);
        toast.error("Analysis Failed", {
          id: loadingToastId,
          description: finalErrorMsg,
        });
      }
      setResult(null);
      setAnalyzedTxHash(null);
    } finally {
      // Ensure loading state is reset unless it was a handled 404
      if (response?.status !== 404) {
        setIsLoading(false);
      }
    }
  };

  /**
   * Renders a loading skeleton for the results card.
   */
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

  /**
   * Helper function to render accordion sections for lists.
   */
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

  // Main component render
  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Transaction Trace Analyzer</CardTitle>
          <CardDescription>
            Enter a transaction hash and select the network to view execution
            details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Enter Transaction Hash (e.g., 0x...)"
              className="flex-grow text-sm sm:text-base"
              disabled={isLoading}
            />
            <Select
              value={selectedNetwork}
              onValueChange={setSelectedNetwork}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select Network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mainnet">Mainnet</SelectItem>
                <SelectItem value="sepolia">Sepolia</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !txHash}
              className="text-sm sm:text-base"
            >
              {isLoading ? "Analyzing..." : "Analyze"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Area */}
      <div className="min-h-[200px]">
        {isLoading && <LoadingSkeleton />}
        {/* Display specific UI error if present */}
        {error && !isLoading && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {/* Display results if available and no error/loading */}
        {result && result.summary && !error && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>Trace Analysis Results</span>
                  <Badge
                    variant={
                      result.summary.network === "sepolia"
                        ? "secondary"
                        : "default"
                    }
                  >
                    {result.summary.network === "sepolia"
                      ? "Sepolia"
                      : "Mainnet"}
                  </Badge>
                </div>
                {analyzedTxHash && (
                  <EtherscanLink
                    type="tx"
                    hash={analyzedTxHash}
                    network={result.summary.network}
                    className="text-xs font-normal"
                  >
                    View Transaction
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
                    ? "Transaction Failed"
                    : "Transaction Succeeded"}
                </AlertTitle>
                <AlertDescription className="text-xs break-all">
                  Return Value:{" "}
                  <HexDisplay value={result.summary.returnValue || "N/A"} />
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent className="space-y-4 text-sm sm:text-base">
              {/* Basic Info */}
              <div>
                <p>
                  <strong className="font-semibold">Total Gas Used:</strong>{" "}
                  {result.summary.totalGasUsed.toLocaleString()}
                </p>
                <p className="inline-flex items-center gap-1">
                  <strong className="font-semibold">Max Call Depth:</strong>{" "}
                  {result.summary.maxDepth}
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Maximum nested internal call depth.</p>
                    </TooltipContent>
                  </Tooltip>
                </p>
              </div>
              {/* Opcode Distribution */}
              {Object.keys(result.summary.opCodeCounts).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Opcode Distribution (Top 10)
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opcode</TableHead>
                        <TableHead className="text-right">Count</TableHead>
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
              {/* Accordion for Details */}
              <Accordion type="single" collapsible className="w-full">
                {/* External/Internal Calls */}
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
                      {/* Adjusted dark mode colors */}
                      <div className="flex justify-between items-center">
                        <span className="break-all flex items-center gap-1">
                          {call.isSwapRelated && (
                            <Repeat2 className="h-3 w-3 text-blue-600" />
                          )}
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
                          )}
                        </span>
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
                          )}
                      </div>
                      {call.functionName && (
                        <p>
                          <strong>Function:</strong>{" "}
                          <span className="font-mono">{call.functionName}</span>
                        </p>
                      )}
                      {call.args && Object.keys(call.args).length > 0 && (
                        <div>
                          <p>
                            <strong>Arguments (Estimated):</strong>
                          </p>
                          <ul className="list-disc list-inside pl-4">
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
                                    {value} {call.targetName?.split(" ")[0]}
                                  </span> // Show formatted value + symbol
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
                        <strong>Gas Provided:</strong>{" "}
                        {parseInt(call.gas, 16).toLocaleString()}
                      </p>
                      <p>
                        <strong>Gas Used (Internal Est.):</strong>{" "}
                        {call.gasUsed?.toLocaleString() ?? "N/A (Est.)"}
                      </p>
                      <p>
                        <strong>Value:</strong>{" "}
                        {parseInt(call.value, 16).toLocaleString()} Wei
                      </p>
                    </li>
                  )
                )}
                {/* Storage Writes */}
                {renderObjectList(
                  "storage-writes",
                  "Storage Writes",
                  result.summary.storageWrites,
                  (write: StorageWriteItem, index) => (
                    <li
                      key={`sstore-${index}`}
                      className="p-2 bg-gray-100 dark:bg-gray-800/50 rounded border space-y-1"
                    >
                      <p className="break-all">
                        <strong>Slot:</strong> <HexDisplay value={write.slot} />
                      </p>
                      <p className="break-all">
                        <strong>Value:</strong>{" "}
                        <HexDisplay value={write.value} />
                      </p>
                    </li>
                  )
                )}
                {/* Events */}
                {renderObjectList(
                  "events",
                  "Events",
                  result.summary.events,
                  (eventItem: EventItem, index) => (
                    <li
                      key={`event-${index}`}
                      className="p-2 bg-gray-100 dark:bg-gray-800/50 rounded border space-y-1"
                    >
                      {"eventName" in eventItem ? (
                        <>
                          <p>
                            <strong>Event:</strong> {eventItem.eventName}{" "}
                            {eventItem.tokenSymbol &&
                              `(${eventItem.tokenSymbol})`}
                          </p>
                          <p className="break-all">
                            <strong>Args:</strong>
                          </p>
                          <ul className="list-disc list-inside pl-4">
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
                                <HexDisplay value={topic} prefix={`T${idx}`} />
                              </li>
                            ))}
                          </ul>
                          <p className="break-all">
                            <strong>Data:</strong>{" "}
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

// --- File yang Diperbarui: src/app/api/trace/route.ts ---
// Deskripsi: Menggunakan variabel terpisah untuk nilai bigint dan string terformat.

import { NextResponse, NextRequest } from "next/server";
import {
  decodeEventLog,
  parseAbiItem,
  formatUnits,
  Hex,
  getAddress,
  getEventSelector,
} from "viem";
import type {
  DecodedEvent,
  EventItem,
  ExternalCallItem,
  StorageWriteItem,
  AnalysisSummary,
} from "@/types/analysis";

// --- Konfigurasi (Sama seperti sebelumnya) ---
const PYUSD_CONTRACT_ADDRESS_MAINNET =
  "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const PYUSD_DECIMALS_MAINNET = 6;
const WETH_CONTRACT_ADDRESS_MAINNET =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const WETH_DECIMALS_MAINNET = 18;
const PYUSD_CONTRACT_ADDRESS_SEPOLIA =
  "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
const PYUSD_DECIMALS_SEPOLIA = 6;
const WETH_CONTRACT_ADDRESS_SEPOLIA =
  "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const WETH_DECIMALS_SEPOLIA = 18;
const transferAbiItem = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const TRANSFER_EVENT_SIGNATURE_HASH = getEventSelector(transferAbiItem);
const KNOWN_ADDRESSES_MAINNET: Record<string, string> = {
  [PYUSD_CONTRACT_ADDRESS_MAINNET.toLowerCase()]: "PYUSD Contract",
  [WETH_CONTRACT_ADDRESS_MAINNET.toLowerCase()]: "WETH Contract",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
};
const KNOWN_ADDRESSES_SEPOLIA: Record<string, string> = {
  [PYUSD_CONTRACT_ADDRESS_SEPOLIA.toLowerCase()]: "PYUSD Contract (Sepolia)",
  [WETH_CONTRACT_ADDRESS_SEPOLIA.toLowerCase()]: "WETH Contract (Sepolia)",
};
const KNOWN_FUNCTION_SELECTORS: Record<string, string> = {
  "0xa9059cbb": "transfer(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0xdd62ed3e": "allowance(address,address)",
  "0x70a08231": "balanceOf(address)",
  "0x18160ddd": "totalSupply()",
  "0x313ce567": "decimals()",
  "0x06fdde03": "name()",
  "0x95d89b41": "symbol()",
  "0x38ed1739":
    "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
  "0xfb3bdb41": "swapExactETHForTokens(uint256,address[],address,uint256)",
  "0x7ff36ab5":
    "swapTokensForExactETH(uint256,uint256,address[],address,uint256)",
  "0x18cbafe5":
    "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
  "0xac9650d8": "multicall(bytes[])",
  "0x5ae401dc": "multicall(uint256,bytes[])",
  "0xd0e30db0": "deposit()",
  "0x2e1a7d4d": "withdraw(uint256)",
};
// --- End Configuration ---

// --- Local Interface Definitions ---
interface StructLog {
  pc: number;
  op: string;
  gas: number;
  gasCost: number;
  depth: number;
  stack?: string[];
  memory?: string[];
  storage?: Record<string, string>;
  error?: string;
  topics?: Hex[];
}
interface TraceResult {
  gas: number;
  failed: boolean;
  returnValue: string;
  structLogs: StructLog[];
}
// --- End Local Interface Definitions ---

// Fungsi decode argumen (sama)
function tryDecodeArgsFromStack(
  functionName: string | undefined,
  stack: string[] | undefined,
  targetName: string | undefined,
  network: string,
  PYUSD_DECIMALS: number,
  WETH_DECIMALS: number
): Record<string, any> | undefined {
  /* ... (sama seperti sebelumnya) ... */ if (
    !functionName ||
    !stack ||
    stack.length < 4
  ) {
    return undefined;
  }
  const args: Record<string, any> = {};
  try {
    if (functionName === "transfer(address,uint256)" && stack.length >= 4) {
      args["to"] = getAddress(`0x${stack[stack.length - 3].slice(-40)}`);
      const rawValue = stack[stack.length - 4];
      try {
        const bigIntValue = BigInt(`0x${rawValue}`);
        if (targetName?.startsWith("PYUSD Contract")) {
          args["value"] = formatUnits(bigIntValue, PYUSD_DECIMALS);
        } else if (targetName?.startsWith("WETH Contract")) {
          args["value"] = formatUnits(bigIntValue, WETH_DECIMALS);
        } else {
          args["value"] = `0x${rawValue}`;
        }
      } catch {
        args["value"] = `0x${rawValue}`;
      }
    } else if (
      functionName === "approve(address,uint256)" &&
      stack.length >= 4
    ) {
      args["spender"] = getAddress(`0x${stack[stack.length - 3].slice(-40)}`);
      args["value"] = `0x${stack[stack.length - 4]}`;
    } else {
      return undefined;
    }
    for (const key in args) {
      if (
        (key === "to" || key === "spender") &&
        typeof args[key] === "string" &&
        (!args[key].startsWith("0x") || args[key].length !== 42)
      ) {
        console.warn(
          `Invalid address format extracted for arg ${key}: ${args[key]}`
        );
        return undefined;
      }
    }
    return Object.keys(args).length > 0 ? args : undefined;
  } catch (e) {
    console.error(
      `Error decoding args for ${functionName} from stack:`,
      e,
      stack
    );
    return undefined;
  }
}

// Fungsi analisis utama
function analyzeStructLogs(
  trace: TraceResult,
  network: string
): AnalysisSummary {
  const KNOWN_ADDRESSES =
    network === "sepolia" ? KNOWN_ADDRESSES_SEPOLIA : KNOWN_ADDRESSES_MAINNET;
  const PYUSD_CONTRACT_ADDRESS =
    network === "sepolia"
      ? PYUSD_CONTRACT_ADDRESS_SEPOLIA
      : PYUSD_CONTRACT_ADDRESS_MAINNET;
  const PYUSD_DECIMALS =
    network === "sepolia" ? PYUSD_DECIMALS_SEPOLIA : PYUSD_DECIMALS_MAINNET;
  const WETH_CONTRACT_ADDRESS =
    network === "sepolia"
      ? WETH_CONTRACT_ADDRESS_SEPOLIA
      : WETH_CONTRACT_ADDRESS_MAINNET;
  const WETH_DECIMALS =
    network === "sepolia" ? WETH_DECIMALS_SEPOLIA : WETH_DECIMALS_MAINNET;

  const summary: AnalysisSummary = {
    totalGasUsed: trace.gas || 0,
    opCodeCounts: {},
    maxDepth: 0,
    events: [],
    storageWrites: [],
    externalCalls: [],
    failed: trace.failed,
    returnValue: trace.returnValue,
    network: network,
  };
  let calculatedGas = 0;
  const structLogs = trace.structLogs;
  if (!structLogs || structLogs.length === 0) {
    if (!summary.totalGasUsed) summary.totalGasUsed = 0;
    return summary;
  }

  for (let i = 0; i < structLogs.length; i++) {
    const log = structLogs[i];
    summary.opCodeCounts[log.op] = (summary.opCodeCounts[log.op] || 0) + 1;
    calculatedGas += log.gasCost;
    summary.maxDepth = Math.max(summary.maxDepth, log.depth);

    // Analisis Panggilan (sama)
    if (
      (log.op === "CALL" ||
        log.op === "DELEGATECALL" ||
        log.op === "STATICCALL" ||
        log.op === "CALLCODE") &&
      log.stack &&
      log.stack.length >= 2
    ) {
      try {
        /* ... (sama) ... */ const targetHex = log.stack[log.stack.length - 2];
        if (
          targetHex &&
          typeof targetHex === "string" &&
          targetHex.length >= 40
        ) {
          const targetAddress = getAddress(`0x${targetHex.slice(-40)}`);
          const targetAddressLower = targetAddress.toLowerCase();
          const gas =
            log.stack.length >= 1 ? log.stack[log.stack.length - 1] : "0";
          const value =
            log.op === "CALL" && log.stack.length >= 3
              ? log.stack[log.stack.length - 3]
              : "0";
          let functionName: string | undefined = undefined;
          for (let j = Math.max(0, i - 5); j < i; j++) {
            const prevLog = structLogs[j];
            if (
              prevLog.op === "PUSH4" &&
              prevLog.stack &&
              prevLog.stack.length > 0
            ) {
              const nextLogStack = structLogs[j + 1]?.stack;
              if (nextLogStack && nextLogStack.length > 0) {
                const potentialSelector = `0x${nextLogStack[
                  nextLogStack.length - 1
                ].substring(0, 8)}`;
                if (KNOWN_FUNCTION_SELECTORS[potentialSelector]) {
                  functionName = KNOWN_FUNCTION_SELECTORS[potentialSelector];
                  break;
                }
              }
            }
            if (
              prevLog.op === "PUSH4" &&
              structLogs[j + 1]?.op === "PUSH1" &&
              structLogs[j + 1]?.stack?.slice(-1)[0] === "00" &&
              structLogs[j + 2]?.op === "MSTORE"
            ) {
              const nextLogStack = structLogs[j + 1]?.stack;
              if (nextLogStack && nextLogStack.length > 0) {
                const potentialSelector = `0x${nextLogStack[
                  nextLogStack.length - 1
                ].substring(0, 8)}`;
                if (KNOWN_FUNCTION_SELECTORS[potentialSelector]) {
                  functionName = KNOWN_FUNCTION_SELECTORS[potentialSelector];
                  break;
                }
              }
            }
          }
          let callGasUsed = 0;
          const startDepth = log.depth;
          for (let k = i + 1; k < structLogs.length; k++) {
            const nextLog = structLogs[k];
            if (nextLog.depth > startDepth) {
              callGasUsed += nextLog.gasCost;
            } else if (nextLog.depth <= startDepth) {
              if (
                k === i + 1 &&
                (nextLog.op === "RETURN" ||
                  nextLog.op === "REVERT" ||
                  nextLog.op === "STOP")
              ) {
                callGasUsed += nextLog.gasCost;
              }
              break;
            }
          }
          const targetName = KNOWN_ADDRESSES[targetAddressLower] || undefined;
          const decodedArgs = tryDecodeArgsFromStack(
            functionName,
            log.stack,
            targetName,
            network,
            PYUSD_DECIMALS,
            WETH_DECIMALS
          );
          const isSwapRelated = !!(
            targetName?.includes("Uniswap") ||
            targetName?.includes("SushiSwap") ||
            targetName?.includes("Curve") ||
            functionName?.toLowerCase().includes("swap")
          );
          const callItem: ExternalCallItem = {
            target: targetAddress,
            targetName: targetName,
            functionName: functionName,
            gas: `0x${gas}`,
            value: `0x${value}`,
            gasUsed: callGasUsed > 0 ? callGasUsed : undefined,
            args: decodedArgs,
            isSwapRelated: isSwapRelated,
          };
          summary.externalCalls.push(callItem);
        } else {
          console.warn(
            `Invalid target address format on stack at step ${i}:`,
            targetHex
          );
        }
      } catch (e) {
        console.error("Error parsing call data from stack:", e, log.stack);
      }
    }
    // Analisis Storage (sama)
    if (log.op === "SSTORE" && log.stack && log.stack.length >= 2) {
      try {
        /* ... (sama) ... */ const slot = log.stack[log.stack.length - 1];
        const value = log.stack[log.stack.length - 2];
        summary.storageWrites.push({ slot: `0x${slot}`, value: `0x${value}` });
      } catch (e) {
        console.error("Error parsing SSTORE data from stack:", e, log.stack);
      }
    }

    // Analisis Event
    if (log.op.startsWith("LOG") && log.topics && log.topics.length > 0) {
      const topics = log.topics as Hex[];
      let eventData: Hex = "0x";
      if (log.stack && log.stack.length >= 2) {
        try {
          /* ... (ekstraksi eventData sama) ... */ const offset = parseInt(
            log.stack[log.stack.length - 1],
            16
          );
          const length = parseInt(log.stack[log.stack.length - 2], 16);
          if (log.memory && length > 0) {
            const memWordsNeeded = Math.ceil(length / 32);
            const startWordIndex = Math.floor(offset / 32);
            let combinedHex = "";
            for (let k = 0; k < memWordsNeeded; k++) {
              combinedHex +=
                log.memory?.[startWordIndex + k]?.padStart(64, "0") ??
                "0".repeat(64);
            }
            const startByteIndex = offset % 32;
            eventData = ("0x" +
              combinedHex.substring(
                startByteIndex * 2,
                startByteIndex * 2 + length * 2
              )) as Hex;
          }
        } catch (e) {
          console.error("Error extracting event data from memory for LOG:", e);
          eventData = "0x";
        }
      }

      let decoded = false;
      if (topics[0] === TRANSFER_EVENT_SIGNATURE_HASH) {
        try {
          const decodedLog = decodeEventLog({
            abi: [transferAbiItem],
            data: eventData,
            topics: topics as [Hex, ...Hex[]],
            strict: false,
          });

          // FIX: Gunakan variabel terpisah untuk nilai mentah dan terformat
          const rawValue = decodedLog.args.value; // Tipe: unknown | bigint | string | number ...
          let displayValue: string = String(rawValue); // Default ke string
          let tokenSymbol = "Unknown ERC20";

          if (typeof rawValue === "bigint") {
            // Hanya format jika bigint
            const fromLower = String(decodedLog.args.from).toLowerCase();
            const toLower = String(decodedLog.args.to).toLowerCase();

            if (
              PYUSD_CONTRACT_ADDRESS &&
              (fromLower === PYUSD_CONTRACT_ADDRESS.toLowerCase() ||
                toLower === PYUSD_CONTRACT_ADDRESS.toLowerCase())
            ) {
              // Gunakan rawValue (bigint) untuk formatUnits
              displayValue = formatUnits(rawValue, PYUSD_DECIMALS);
              tokenSymbol = network === "sepolia" ? "PYUSD (Sepolia)" : "PYUSD";
            } else if (
              WETH_CONTRACT_ADDRESS &&
              (fromLower === WETH_CONTRACT_ADDRESS.toLowerCase() ||
                toLower === WETH_CONTRACT_ADDRESS.toLowerCase())
            ) {
              // Gunakan rawValue (bigint) untuk formatUnits
              displayValue = formatUnits(rawValue, WETH_DECIMALS);
              tokenSymbol = network === "sepolia" ? "WETH (Sepolia)" : "WETH";
            } else {
              displayValue = rawValue.toString(); // Konversi bigint tak dikenal ke string
            }
          }
          // Jika rawValue bukan bigint, displayValue sudah di-set ke String(rawValue)

          summary.events.push({
            eventName: decodedLog.eventName,
            tokenSymbol: tokenSymbol,
            args: {
              from: decodedLog.args.from,
              to: decodedLog.args.to,
              // Gunakan displayValue yang sudah pasti string
              value: `${displayValue}${
                tokenSymbol !== "Unknown ERC20"
                  ? " " + tokenSymbol.split(" ")[0]
                  : ""
              }`,
            },
          });
          decoded = true;
        } catch (e) {
          console.warn(
            `Failed to decode potential Transfer event on ${network}:`,
            { topics, eventData, error: e }
          );
        }
      }

      if (!decoded) {
        summary.events.push({ raw: { topics: topics, data: eventData } });
      }
    }
  } // End loop
  if (!summary.totalGasUsed && calculatedGas > 0) {
    summary.totalGasUsed = calculatedGas;
  }
  return summary;
}

// Handler POST (sama)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const txHash = body.txHash as string;
    const network = (body.network as string) || "mainnet";
    if (
      !txHash ||
      typeof txHash !== "string" ||
      !txHash.startsWith("0x") ||
      txHash.length !== 66
    ) {
      return NextResponse.json(
        { message: "Invalid Transaction Hash." },
        { status: 400 }
      );
    }
    if (network !== "mainnet" && network !== "sepolia") {
      return NextResponse.json(
        { message: "Invalid Network. Choose 'mainnet' or 'sepolia'." },
        { status: 400 }
      );
    }
    const rpcUrlMainnet =
      process.env.GCP_RPC_URL_MAINNET || process.env.GCP_RPC_URL;
    const rpcUrlSepolia = process.env.GCP_RPC_URL_SEPOLIA;
    let baseUrl = network === "sepolia" ? rpcUrlSepolia : rpcUrlMainnet;
    if (!baseUrl) {
      const errorMsg = `RPC URL for network ${network} is not configured in environment variables (Expected: ${
        network === "sepolia" ? "GCP_RPC_URL_SEPOLIA" : "GCP_RPC_URL_MAINNET"
      }).`;
      console.error(errorMsg);
      return NextResponse.json(
        { message: "Server configuration error." },
        { status: 500 }
      );
    }
    const apiKey = process.env.GCP_API_KEY;
    const gcpRpcUrl = apiKey ? `${baseUrl}?key=${apiKey}` : baseUrl;
    const payload = {
      jsonrpc: "2.0",
      method: "debug_traceTransaction",
      params: [txHash, {}],
      id: 1,
    };
    console.log(
      `Calling RPC (${network}) for tx: ${txHash} at ${baseUrl.split("?")[0]}`
    );
    const response = await fetch(gcpRpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `RPC Error (${network} - ${response.status}): ${errorBody}`
      );
      let errorMessage = `RPC request failed (${network}) with status ${response.status}.`;
      let statusCode = response.status >= 500 ? 500 : 400;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          errorMessage = `RPC Error: ${errorJson.error.message} (Code: ${
            errorJson.error.code || "N/A"
          })`;
          if (errorJson.error.code === -32000) {
            console.log(`Transaction ${txHash} not found on ${network}.`);
            errorMessage = `Transaction not found on ${network}. Please verify the hash and selected network.`;
            statusCode = 404;
          }
        }
      } catch (e) {
        /* Ignore */
      }
      return NextResponse.json(
        { message: errorMessage },
        { status: statusCode }
      );
    }
    const data = await response.json();
    if (data.error) {
      console.error("RPC returned error in JSON (status 2xx):", data.error);
      let errorMessage = `RPC Error: ${data.error.message} (Code: ${data.error.code})`;
      let statusCode = 500;
      if (data.error.code === -32000) {
        errorMessage = `Transaction not found on ${network}. Please verify the hash and selected network.`;
        statusCode = 404;
      }
      return NextResponse.json(
        { message: errorMessage },
        { status: statusCode }
      );
    }
    if (!data.result || !data.result.structLogs) {
      console.error("Invalid trace result structure:", data);
      throw new Error("Invalid trace result structure from RPC.");
    }
    console.log(
      `Successfully fetched trace for tx: ${txHash} on ${network}. Analyzing...`
    );
    const analysisSummary = analyzeStructLogs(
      data.result as TraceResult,
      network
    );
    console.log("Analysis complete.");
    return NextResponse.json({ summary: analysisSummary }, { status: 200 });
  } catch (error: any) {
    console.error("[API_TRACE_ERROR] Unhandled exception:", error);
    if (error.message?.includes("Transaction not found")) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json(
      {
        message:
          error.message || "An unexpected internal server error occurred.",
      },
      { status: 500 }
    );
  }
}

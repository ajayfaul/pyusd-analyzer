import { NextResponse } from "next/server";
import { decodeEventLog, parseAbiItem, formatUnits, Hex } from "viem";
const PYUSD_CONTRACT_ADDRESS = "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const PYUSD_DECIMALS = 6;
const WETH_CONTRACT_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const WETH_DECIMALS = 18;
const transferAbiItem = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const TRANSFER_EVENT_SIGNATURE_HASH = transferAbiItem.inputs[0].hash;
const KNOWN_ADDRESSES: Record<string, string> = {
  [PYUSD_CONTRACT_ADDRESS.toLowerCase()]: "PYUSD Contract",
  [WETH_CONTRACT_ADDRESS.toLowerCase()]: "WETH Contract",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
  "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7": "Curve: 3Pool",
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
interface DecodedEvent {
  eventName: string;
  args: { [key: string]: any };
  tokenSymbol?: string;
}
type EventItem = DecodedEvent | { raw: { topics: Hex[]; data: Hex } };
interface ExternalCallItem {
  target: string;
  targetName?: string;
  functionName?: string;
  gas: string;
  value: string;
  gasUsed?: number;
  args?: Record<string, any>;
  isSwapRelated?: boolean;
}
interface StorageWriteItem {
  slot: string;
  value: string;
}
interface AnalysisSummary {
  totalGasUsed: number;
  opCodeCounts: { [key: string]: number };
  maxDepth: number;
  events: EventItem[];
  storageWrites: StorageWriteItem[];
  externalCalls: ExternalCallItem[];
  failed: boolean;
  returnValue: string;
}
function tryDecodeArgsFromStack(
  functionName: string | undefined,
  stack: string[] | undefined,
  targetName: string | undefined
): Record<string, any> | undefined {
  if (!functionName || !stack || stack.length < 4) {
    return undefined;
  }
  const args: Record<string, any> = {};
  try {
    if (functionName === "transfer(address,uint256)" && stack.length >= 4) {
      args["to"] = `0x${stack[stack.length - 3].slice(-40)}`;
      const rawValue = stack[stack.length - 4];
      try {
        const bigIntValue = BigInt(`0x${rawValue}`);
        if (targetName === "PYUSD Contract") {
          args["value"] = formatUnits(bigIntValue, PYUSD_DECIMALS);
        } else if (targetName === "WETH Contract") {
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
      args["spender"] = `0x${stack[stack.length - 3].slice(-40)}`;
      args["value"] = `0x${stack[stack.length - 4]}`;
    } else {
      return undefined;
    }
    for (const key in args) {
      if (
        (key === "to" || key === "from" || key === "spender") &&
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
function analyzeStructLogs(trace: TraceResult): AnalysisSummary {
  const summary: AnalysisSummary = {
    totalGasUsed: trace.gas || 0,
    opCodeCounts: {},
    maxDepth: 0,
    events: [],
    storageWrites: [],
    externalCalls: [],
    failed: trace.failed,
    returnValue: trace.returnValue,
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
    if (
      (log.op === "CALL" ||
        log.op === "DELEGATECALL" ||
        log.op === "STATICCALL" ||
        log.op === "CALLCODE") &&
      log.stack &&
      log.stack.length >= 2
    ) {
      try {
        const targetHex = log.stack[log.stack.length - 2];
        if (
          targetHex &&
          typeof targetHex === "string" &&
          targetHex.length >= 40
        ) {
          const targetAddress = `0x${targetHex.slice(-40)}`;
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
            targetName
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
    if (log.op === "SSTORE" && log.stack && log.stack.length >= 2) {
      try {
        const slot = log.stack[log.stack.length - 1];
        const value = log.stack[log.stack.length - 2];
        summary.storageWrites.push({ slot: `0x${slot}`, value: `0x${value}` });
      } catch (e) {
        console.error("Error parsing SSTORE data from stack:", e, log.stack);
      }
    }
    if (log.op.startsWith("LOG") && log.topics && log.topics.length > 0) {
      const topics = log.topics as Hex[];
      let eventData: Hex = "0x";
      if (log.stack && log.stack.length >= 2) {
        try {
          const offset = parseInt(log.stack[log.stack.length - 1], 16);
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
            topics: topics,
            strict: false,
          });
          let formattedValue = decodedLog.args.value;
          let tokenSymbol = "Unknown ERC20";
          if (typeof formattedValue === "bigint") {
            const fromLower = String(decodedLog.args.from).toLowerCase();
            const toLower = String(decodedLog.args.to).toLowerCase();
            if (
              fromLower === PYUSD_CONTRACT_ADDRESS.toLowerCase() ||
              toLower === PYUSD_CONTRACT_ADDRESS.toLowerCase()
            ) {
              formattedValue = formatUnits(formattedValue, PYUSD_DECIMALS);
              tokenSymbol = "PYUSD";
            } else if (
              fromLower === WETH_CONTRACT_ADDRESS.toLowerCase() ||
              toLower === WETH_CONTRACT_ADDRESS.toLowerCase()
            ) {
              formattedValue = formatUnits(formattedValue, WETH_DECIMALS);
              tokenSymbol = "WETH";
            } else {
              formattedValue = formattedValue.toString();
            }
          }
          summary.events.push({
            eventName: decodedLog.eventName,
            tokenSymbol: tokenSymbol,
            args: {
              from: decodedLog.args.from,
              to: decodedLog.args.to,
              value: `${formattedValue}${
                tokenSymbol !== "Unknown ERC20" ? " " + tokenSymbol : ""
              }`,
            },
          });
          decoded = true;
        } catch (e) {
          console.warn("Failed to decode potential Transfer event:", {
            topics,
            eventData,
            error: e,
          });
        }
      }
      if (!decoded) {
        summary.events.push({ raw: { topics: topics, data: eventData } });
      }
    }
  }
  if (!summary.totalGasUsed) {
    summary.totalGasUsed = calculatedGas;
  }
  return summary;
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const txHash = body.txHash;
    if (
      !txHash ||
      typeof txHash !== "string" ||
      !txHash.startsWith("0x") ||
      txHash.length !== 66
    ) {
      return NextResponse.json(
        { message: "Transaction Hash tidak valid." },
        { status: 400 }
      );
    }
    const apiKey = process.env.GCP_API_KEY;
    if (!apiKey) {
      console.error("GCP_API_KEY...");
      return NextResponse.json(
        { message: "Konfigurasi server error (API Key...)." },
        { status: 500 }
      );
    }
    const baseUrl = process.env.GCP_RPC_URL;
    if (!baseUrl) {
      console.error("GCP_RPC_URL...");
      return NextResponse.json(
        { message: "Konfigurasi server error (RPC URL...)." },
        { status: 500 }
      );
    }
    const gcpRpcUrl = `${baseUrl}?key=${apiKey}`;
    const payload = {
      jsonrpc: "2.0",
      method: "debug_traceTransaction",
      params: [txHash, {}],
      id: 1,
    };
    console.log(`Calling GCP RPC for tx: ${txHash}`);
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
      console.error(`GCP RPC Error (${response.status}): ${errorBody}`);
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error && errorJson.error.message) {
          throw new Error(
            `GCP RPC Error: ${errorJson.error.message} (Code: ${
              errorJson.error.code || "N/A"
            })`
          );
        }
      } catch (e) {
        /* Ignore */
      }
      throw new Error(
        `GCP RPC request failed with status ${response.status}: ${errorBody}`
      );
    }
    const data = await response.json();
    if (data.error) {
      console.error("GCP RPC returned error in JSON:", data.error);
      throw new Error(
        `GCP RPC Error: ${data.error.message} (Code: ${data.error.code})`
      );
    }
    if (!data.result || !data.result.structLogs) {
      console.error("Invalid trace result structure:", data);
      throw new Error(
        "Hasil trace dari GCP tidak valid atau tidak berisi structLogs."
      );
    }
    console.log(`Successfully fetched trace for tx: ${txHash}. Analyzing...`);
    const analysisSummary = analyzeStructLogs(data.result as TraceResult);
    console.log("Analysis complete.");
    return NextResponse.json({ summary: analysisSummary }, { status: 200 });
  } catch (error: any) {
    console.error("[API_TRACE_ERROR]", error);
    return NextResponse.json(
      { message: error.message || "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}

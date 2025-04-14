// Description: API route to fetch and analyze transaction traces using debug_traceTransaction.

import { NextResponse, NextRequest } from "next/server";
import {
  decodeEventLog,
  parseAbiItem,
  formatUnits,
  Hex,
  getAddress,
} from "viem";
import type {
  StructLog,
  TraceResult,
  DecodedEvent,
  EventItem,
  ExternalCallItem,
  StorageWriteItem,
  AnalysisSummary,
} from "@/types/analysis"; // Import types

// --- Configuration ---
// Mainnet Constants
const PYUSD_CONTRACT_ADDRESS_MAINNET =
  "0x6c3ea9036406852006290770bedfcaba0e23a0e8";
const PYUSD_DECIMALS_MAINNET = 6;
const WETH_CONTRACT_ADDRESS_MAINNET =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const WETH_DECIMALS_MAINNET = 18;

// Sepolia Constants
const PYUSD_CONTRACT_ADDRESS_SEPOLIA =
  "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
const PYUSD_DECIMALS_SEPOLIA = 6; // Assuming same decimals
const WETH_CONTRACT_ADDRESS_SEPOLIA =
  "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const WETH_DECIMALS_SEPOLIA = 18;

// Common ABI Items and Hashes
const transferAbiItem = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const TRANSFER_EVENT_SIGNATURE_HASH = transferAbiItem.inputs[0].hash; // Viem adds this hash

// Known Addresses (Mainnet)
const KNOWN_ADDRESSES_MAINNET: Record<string, string> = {
  [PYUSD_CONTRACT_ADDRESS_MAINNET.toLowerCase()]: "PYUSD Contract",
  [WETH_CONTRACT_ADDRESS_MAINNET.toLowerCase()]: "WETH Contract",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
  // Add more known Mainnet addresses if needed
};
// Known Addresses (Sepolia)
const KNOWN_ADDRESSES_SEPOLIA: Record<string, string> = {
  [PYUSD_CONTRACT_ADDRESS_SEPOLIA.toLowerCase()]: "PYUSD Contract (Sepolia)",
  [WETH_CONTRACT_ADDRESS_SEPOLIA.toLowerCase()]: "WETH Contract (Sepolia)",
  // Add known Sepolia addresses (e.g., Uniswap routers) if needed
};

// Known Function Selectors (Common)
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
  "0xd0e30db0": "deposit()", // WETH
  "0x2e1a7d4d": "withdraw(uint256)", // WETH
};
// --- End Configuration ---

/**
 * Tries to decode function arguments from the stack based on known function signatures.
 * This is a HEURISTIC and might not always be accurate.
 * @param functionName Guessed function signature string.
 * @param stack EVM stack before the CALL opcode.
 * @param targetName Known name of the target contract.
 * @param network Current network ('mainnet' or 'sepolia').
 * @param PYUSD_DECIMALS Decimals for PYUSD on the current network.
 * @param WETH_DECIMALS Decimals for WETH on the current network.
 * @returns Decoded arguments object or undefined.
 */
function tryDecodeArgsFromStack(
  functionName: string | undefined,
  stack: string[] | undefined,
  targetName: string | undefined,
  network: string,
  PYUSD_DECIMALS: number,
  WETH_DECIMALS: number
): Record<string, any> | undefined {
  if (!functionName || !stack || stack.length < 4) {
    return undefined;
  }
  const args: Record<string, any> = {};
  try {
    // Stack layout heuristic for common ERC20 functions
    // Stack grows downwards: [..., argN, ..., arg1, arg0, targetAddress, gas]
    // We access relative to the end: stack[stack.length - N]
    if (functionName === "transfer(address,uint256)" && stack.length >= 4) {
      args["to"] = getAddress(`0x${stack[stack.length - 3].slice(-40)}`); // Arg 1 (to)
      const rawValue = stack[stack.length - 4]; // Arg 0 (value)
      try {
        const bigIntValue = BigInt(`0x${rawValue}`);
        if (targetName?.startsWith("PYUSD Contract")) {
          args["value"] = formatUnits(bigIntValue, PYUSD_DECIMALS);
        } else if (targetName?.startsWith("WETH Contract")) {
          args["value"] = formatUnits(bigIntValue, WETH_DECIMALS);
        } else {
          args["value"] = `0x${rawValue}`;
        } // Keep raw if unknown token
      } catch {
        args["value"] = `0x${rawValue}`;
      } // Fallback if BigInt fails
    } else if (
      functionName === "approve(address,uint256)" &&
      stack.length >= 4
    ) {
      args["spender"] = getAddress(`0x${stack[stack.length - 3].slice(-40)}`); // Arg 1 (spender)
      args["value"] = `0x${stack[stack.length - 4]}`; // Arg 0 (value) - Keep raw hex for approve
    } else {
      return undefined; // No decoding logic for this function
    }

    // Basic validation for extracted addresses
    for (const key in args) {
      if (
        (key === "to" || key === "spender") &&
        typeof args[key] === "string" &&
        (!args[key].startsWith("0x") || args[key].length !== 42)
      ) {
        console.warn(
          `Invalid address format extracted for arg ${key}: ${args[key]}`
        );
        return undefined; // Decoding failed
      }
    }
    return Object.keys(args).length > 0 ? args : undefined; // Return args if any were decoded
  } catch (e) {
    console.error(
      `Error decoding args for ${functionName} from stack:`,
      e,
      stack
    );
    return undefined;
  }
}

/**
 * Analyzes the structLogs from debug_traceTransaction to extract relevant information.
 * @param trace The trace result object from the RPC call.
 * @param network The network ('mainnet' or 'sepolia') the trace is from.
 * @returns An AnalysisSummary object.
 */
function analyzeStructLogs(
  trace: TraceResult,
  network: string
): AnalysisSummary {
  // Select constants based on the network
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

  // Initialize summary object
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

  // Return early if no logs
  if (!structLogs || structLogs.length === 0) {
    if (!summary.totalGasUsed) summary.totalGasUsed = 0; // Ensure totalGasUsed is set
    return summary;
  }

  // Iterate through each step (log) in the trace
  for (let i = 0; i < structLogs.length; i++) {
    const log = structLogs[i];

    // Count opcodes
    summary.opCodeCounts[log.op] = (summary.opCodeCounts[log.op] || 0) + 1;
    // Sum gas cost (can be used if trace.gas is missing)
    calculatedGas += log.gasCost;
    // Track max call depth
    summary.maxDepth = Math.max(summary.maxDepth, log.depth);

    // --- External/Internal Call Analysis ---
    if (
      (log.op === "CALL" ||
        log.op === "DELEGATECALL" ||
        log.op === "STATICCALL" ||
        log.op === "CALLCODE") &&
      log.stack &&
      log.stack.length >= 2
    ) {
      try {
        const targetHex = log.stack[log.stack.length - 2]; // Target address is usually second from top
        if (
          targetHex &&
          typeof targetHex === "string" &&
          targetHex.length >= 40
        ) {
          const targetAddress = getAddress(`0x${targetHex.slice(-40)}`); // Checksum address
          const targetAddressLower = targetAddress.toLowerCase();
          const gas =
            log.stack.length >= 1 ? log.stack[log.stack.length - 1] : "0"; // Gas provided
          const value =
            log.op === "CALL" && log.stack.length >= 3
              ? log.stack[log.stack.length - 3]
              : "0"; // Value sent (only for CALL)
          let functionName: string | undefined = undefined;

          // Heuristic function signature identification (look back a few steps for PUSH4)
          for (let j = Math.max(0, i - 5); j < i; j++) {
            const prevLog = structLogs[j];
            // Common pattern: PUSH4 selector, ..., CALL
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
            // Another pattern sometimes seen
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

          // Estimate gas used within this call frame (simplified)
          let callGasUsed = 0;
          const startDepth = log.depth;
          for (let k = i + 1; k < structLogs.length; k++) {
            const nextLog = structLogs[k];
            if (nextLog.depth > startDepth) {
              callGasUsed += nextLog.gasCost;
            } // Sum gas cost of deeper steps
            else if (nextLog.depth <= startDepth) {
              // Include gas cost of the final RETURN/REVERT/STOP of this frame if it's the immediate next step
              if (
                k === i + 1 &&
                (nextLog.op === "RETURN" ||
                  nextLog.op === "REVERT" ||
                  nextLog.op === "STOP")
              ) {
                callGasUsed += nextLog.gasCost;
              }
              break; // Stop when returning to the same or shallower depth
            }
          }

          const targetName = KNOWN_ADDRESSES[targetAddressLower]; // Get known name based on network
          // Attempt to decode arguments using the heuristic function
          const decodedArgs = tryDecodeArgsFromStack(
            functionName,
            log.stack,
            targetName,
            network,
            PYUSD_DECIMALS,
            WETH_DECIMALS
          );
          // Flag if call seems related to swapping (based on target name or function name)
          const isSwapRelated = !!(
            targetName?.includes("Uniswap") ||
            targetName?.includes("SushiSwap") ||
            targetName?.includes("Curve") ||
            functionName?.toLowerCase().includes("swap")
          );

          // Add call details to summary
          summary.externalCalls.push({
            target: targetAddress,
            targetName: targetName,
            functionName: functionName,
            gas: `0x${gas}`,
            value: `0x${value}`,
            gasUsed: callGasUsed > 0 ? callGasUsed : undefined,
            args: decodedArgs,
            isSwapRelated: isSwapRelated,
          });
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

    // --- Storage Write Analysis ---
    if (log.op === "SSTORE" && log.stack && log.stack.length >= 2) {
      try {
        const slot = log.stack[log.stack.length - 1]; // Slot is usually top of stack
        const value = log.stack[log.stack.length - 2]; // Value is second from top
        summary.storageWrites.push({ slot: `0x${slot}`, value: `0x${value}` });
      } catch (e) {
        console.error("Error parsing SSTORE data from stack:", e, log.stack);
      }
    }

    // --- Event Log Analysis ---
    if (log.op.startsWith("LOG") && log.topics && log.topics.length > 0) {
      const topics = log.topics as Hex[];
      let eventData: Hex = "0x";
      // Extract event data from memory if available (based on stack offset/length)
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
      // Attempt to decode known events (e.g., ERC20 Transfer)
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
            // Check against network-specific addresses
            if (
              PYUSD_CONTRACT_ADDRESS &&
              (fromLower === PYUSD_CONTRACT_ADDRESS.toLowerCase() ||
                toLower === PYUSD_CONTRACT_ADDRESS.toLowerCase())
            ) {
              formattedValue = formatUnits(formattedValue, PYUSD_DECIMALS);
              tokenSymbol = network === "sepolia" ? "PYUSD (Sepolia)" : "PYUSD";
            } else if (
              WETH_CONTRACT_ADDRESS &&
              (fromLower === WETH_CONTRACT_ADDRESS.toLowerCase() ||
                toLower === WETH_CONTRACT_ADDRESS.toLowerCase())
            ) {
              formattedValue = formatUnits(formattedValue, WETH_DECIMALS);
              tokenSymbol = network === "sepolia" ? "WETH (Sepolia)" : "WETH";
            } else {
              formattedValue = formattedValue.toString();
            } // Keep as string if unknown
          }
          summary.events.push({
            eventName: decodedLog.eventName,
            tokenSymbol: tokenSymbol,
            args: {
              from: decodedLog.args.from,
              to: decodedLog.args.to,
              value: `${formattedValue}${
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

      // If not decoded as a known event, add as raw log
      if (!decoded) {
        summary.events.push({ raw: { topics: topics, data: eventData } });
      }
    }
  } // End loop through logs

  // Use calculated gas if trace didn't provide totalGasUsed
  if (!summary.totalGasUsed && calculatedGas > 0) {
    summary.totalGasUsed = calculatedGas;
  }
  return summary;
}

// Main POST handler for the API route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const txHash = body.txHash as string;
    const network = (body.network as string) || "mainnet"; // Default to mainnet

    // Validate inputs
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

    // Select RPC URL based on network from environment variables
    const rpcUrlMainnet =
      process.env.GCP_RPC_URL_MAINNET || process.env.GCP_RPC_URL; // Fallback for older env var name
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

    // Append API key if provided
    const apiKey = process.env.GCP_API_KEY;
    const gcpRpcUrl = apiKey ? `${baseUrl}?key=${apiKey}` : baseUrl;

    // Prepare JSON-RPC payload for debug_traceTransaction
    const payload = {
      jsonrpc: "2.0",
      method: "debug_traceTransaction",
      params: [txHash, {}],
      id: 1,
    };

    console.log(
      `Calling RPC (${network}) for tx: ${txHash} at ${baseUrl.split("?")[0]}`
    ); // Log URL without API key
    const response = await fetch(gcpRpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Handle RPC errors (including transaction not found)
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `RPC Error (${network} - ${response.status}): ${errorBody}`
      );
      let errorMessage = `RPC request failed (${network}) with status ${response.status}.`;
      let statusCode = response.status >= 500 ? 500 : 400; // Default error status

      try {
        // Try parsing JSON error from node
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          errorMessage = `RPC Error: ${errorJson.error.message} (Code: ${
            errorJson.error.code || "N/A"
          })`;
          // Specific handling for "transaction not found"
          if (errorJson.error.code === -32000) {
            console.log(`Transaction ${txHash} not found on ${network}.`);
            errorMessage = `Transaction not found on ${network}. Please verify the hash and selected network.`;
            statusCode = 404; // Use 404 Not Found
          }
        }
      } catch (e) {
        /* Ignore if body is not JSON */
      }
      // Return the appropriate error response
      return NextResponse.json(
        { message: errorMessage },
        { status: statusCode }
      );
    }

    // Handle successful response
    const data = await response.json();

    // Check for JSON-RPC error within a 2xx response (less common)
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

    // Validate trace result structure
    if (!data.result || !data.result.structLogs) {
      console.error("Invalid trace result structure:", data);
      throw new Error("Invalid trace result structure from RPC.");
    }

    // Analyze the trace logs
    console.log(
      `Successfully fetched trace for tx: ${txHash} on ${network}. Analyzing...`
    );
    const analysisSummary = analyzeStructLogs(
      data.result as TraceResult,
      network
    );
    console.log("Analysis complete.");

    // Return the analysis summary
    return NextResponse.json({ summary: analysisSummary }, { status: 200 });
  } catch (error: any) {
    // Catch unexpected server errors
    console.error("[API_TRACE_ERROR] Unhandled exception:", error);
    return NextResponse.json(
      {
        message:
          error.message || "An unexpected internal server error occurred.",
      },
      { status: 500 }
    );
  }
}

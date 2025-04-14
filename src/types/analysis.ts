  // Description: TypeScript interfaces for analysis data structures.

  import { Hex } from "viem";

  // Interface for decoded event details
  export interface DecodedEvent {
      eventName: string;
      args: { [key: string]: any };
      tokenSymbol?: string; // Optional token symbol (e.g., "PYUSD", "WETH")
  }

  // Union type for event items (either decoded or raw)
  export type EventItem = DecodedEvent | { raw: { topics: Hex[]; data: Hex } };

  // Interface for external/internal call details
  export interface ExternalCallItem {
      target: string; // Target address of the call
      targetName?: string; // Known name of the target address (if available)
      functionName?: string; // Guessed function signature (if available)
      gas: string; // Gas provided for the call (hex string)
      value: string; // ETH value sent with the call (Wei, hex string)
      gasUsed?: number; // Estimated gas used within this call frame (numeric)
      args?: Record<string, any>; // Heuristically decoded arguments
      isSwapRelated?: boolean; // Flag if the call seems related to a DEX swap
  }

  // Interface for storage write operations
  export interface StorageWriteItem {
      slot: string; // Storage slot written to (hex string)
      value: string; // Value written to the slot (hex string)
  }

  // Interface for the overall trace analysis summary
  export interface AnalysisSummary {
      totalGasUsed: number; // Total gas used by the transaction
      opCodeCounts: { [key: string]: number }; // Counts of each executed opcode
      maxDepth: number; // Maximum call stack depth reached
      events: EventItem[]; // List of decoded or raw events
      storageWrites: StorageWriteItem[]; // List of storage write operations
      externalCalls: ExternalCallItem[]; // List of external/internal calls
      failed: boolean; // Whether the transaction failed
      returnValue: string; // Return value of the transaction (hex string)
      network?: string; // Network analyzed ('mainnet' or 'sepolia')
  }

  // Interface for the API response containing the summary
  export interface AnalysisResult {
      summary: AnalysisSummary;
  }

  // --- Interfaces for Historical Data ---

  // Interface for merged daily transfer count and volume
  export interface MergedHistoricalRow {
      date: string;
      count: number;
      volume: number | null;
  }

  // Interface for daily active sender data
  export interface ActiveAddressData {
      date: string;
      active_senders: number;
  }

  // Interface for formatted top transfer data
  export interface TopTransferFormattedRow {
      timestamp: string;
      txHash: string;
      logIndex: number;
      fromAddress: string;
      toAddress: string;
      rawValue: string;
      formattedValue: string | null;
      tokenAddress: string;
  }

  // Interface for daily congestion data (gas limit usage)
  export interface CongestionData {
      date: string;
      avg_gas_limit_used_percent: number | null;
  }

  // Interface for gas price data
  export interface GasPriceData {
      date: string;
      avg_gas_gwei: number | null;
  }
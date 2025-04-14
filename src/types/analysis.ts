import { Hex } from "viem";
export interface DecodedEvent {
  eventName: string;
  args: { [key: string]: any };
  tokenSymbol?: string;
}
export type EventItem = DecodedEvent | { raw: { topics: Hex[]; data: Hex } };
export interface ExternalCallItem {
  target: string;
  targetName?: string;
  functionName?: string;
  gas: string;
  value: string;
  gasUsed?: number;
  args?: Record<string, any>;
  isSwapRelated?: boolean;
}
export interface StorageWriteItem {
  slot: string;
  value: string;
}
export interface AnalysisSummary {
  totalGasUsed: number;
  opCodeCounts: { [key: string]: number };
  maxDepth: number;
  events: EventItem[];
  storageWrites: StorageWriteItem[];
  externalCalls: ExternalCallItem[];
  failed: boolean;
  returnValue: string;
}
export interface AnalysisResult {
  summary: AnalysisSummary;
}
export interface HistoricalRow {
  transfer_date: { value: string };
  transaction_count: number;
}

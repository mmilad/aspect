import { isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowWebSearchConfig } from "../_shared/types";
export function parseWebSearchConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowWebSearchConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) { errors.push(`Node ${nodeId} webSearch config must be an object.`); return undefined; }
  return { queryFrom: typeof raw.queryFrom === "string" ? raw.queryFrom : undefined, maxResultsFrom: typeof raw.maxResultsFrom === "string" ? raw.maxResultsFrom : undefined };
}
export function parseWebSearchNodeConfig(raw: Record<string, unknown>, nodeId: string, errors: string[]): Partial<WorkflowNodeData> {
  const webSearch = parseWebSearchConfig(raw.webSearch, nodeId, errors); return webSearch ? { webSearch } : {};
}

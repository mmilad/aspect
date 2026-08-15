import type { WorkflowNodeData } from "../_shared/types";

export function parseSetNodeConfig(
  raw: Record<string, unknown>,
  _nodeId: string,
  _errors: string[]
): Partial<WorkflowNodeData> {
  return typeof raw.variable === "string" ? { variable: raw.variable.trim() } : {};
}

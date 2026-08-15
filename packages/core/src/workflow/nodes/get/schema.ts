import type { WorkflowNodeData } from "../_shared/types";

export function parseGetNodeConfig(
  raw: Record<string, unknown>,
  _nodeId: string,
  _errors: string[]
): Partial<WorkflowNodeData> {
  return typeof raw.variable === "string" ? { variable: raw.variable.trim() } : {};
}

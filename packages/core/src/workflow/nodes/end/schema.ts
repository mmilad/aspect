import type { WorkflowNodeData } from "../_shared/types";

export function parseEndConfig(
  _raw: Record<string, unknown>,
  _nodeId: string,
  _errors: string[]
): Partial<WorkflowNodeData> {
  return {};
}

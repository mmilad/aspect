import type { WorkflowNodeData } from "../_shared/types";

export function parseStartConfig(
  _raw: Record<string, unknown>,
  _nodeId: string,
  _errors: string[]
): Partial<WorkflowNodeData> {
  return {};
}

import type { WorkflowNodeData } from "../_shared/types";

export function parseTemplateNodeConfig(
  raw: Record<string, unknown>,
  _nodeId: string,
  _errors: string[]
): Partial<WorkflowNodeData> {
  return { template: typeof raw.template === "string" ? raw.template : "" };
}

import type { WorkflowNodeData } from "../_shared/types";

export function parseKnowledgeContextIndexNodeConfig(
  raw: Record<string, unknown>,
  _nodeId: string,
  _errors: string[]
): Partial<WorkflowNodeData> {
  return raw.knowledgeContextIndex === undefined || typeof raw.knowledgeContextIndex === "object"
    ? { knowledgeContextIndex: {} }
    : {};
}

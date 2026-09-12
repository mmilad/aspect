import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgeGetConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

function parseConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowKnowledgeGetConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgeGet config must be an object.`);
    return undefined;
  }
  return {
    datasetKey: optionalString(raw, "datasetKey"),
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    itemIdFrom: optionalString(raw, "itemIdFrom"),
    includeDeletedFrom: optionalString(raw, "includeDeletedFrom"),
    accessFrom: optionalString(raw, "accessFrom")
  };
}

export function parseKnowledgeGetNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgeGet = parseConfig(raw.knowledgeGet, nodeId, errors);
  return knowledgeGet ? { knowledgeGet } : {};
}

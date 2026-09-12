import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgeIngestConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

function parseConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowKnowledgeIngestConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgeIngest config must be an object.`);
    return undefined;
  }
  return {
    datasetKey: optionalString(raw, "datasetKey"),
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    itemIdFrom: optionalString(raw, "itemIdFrom"),
    rawTextFrom: optionalString(raw, "rawTextFrom"),
    metadataFrom: optionalString(raw, "metadataFrom"),
    scopeFrom: optionalString(raw, "scopeFrom")
  };
}

export function parseKnowledgeIngestNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgeIngest = parseConfig(raw.knowledgeIngest, nodeId, errors);
  return knowledgeIngest ? { knowledgeIngest } : {};
}

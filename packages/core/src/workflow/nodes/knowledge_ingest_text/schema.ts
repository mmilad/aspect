import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgeIngestTextConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

function parseConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowKnowledgeIngestTextConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgeIngestText config must be an object.`);
    return undefined;
  }
  return {
    datasetKey: optionalString(raw, "datasetKey"),
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    textFrom: optionalString(raw, "textFrom"),
    metadataFrom: optionalString(raw, "metadataFrom"),
    scopeFrom: optionalString(raw, "scopeFrom"),
    maxCharsFrom: optionalString(raw, "maxCharsFrom"),
    overlapCharsFrom: optionalString(raw, "overlapCharsFrom"),
    ingestionIdFrom: optionalString(raw, "ingestionIdFrom"),
    batchSizeFrom: optionalString(raw, "batchSizeFrom"),
    processorStrategyFrom: optionalString(raw, "processorStrategyFrom"),
    extractPrimitivesFrom: optionalString(raw, "extractPrimitivesFrom")
  };
}

export function parseKnowledgeIngestTextNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgeIngestText = parseConfig(raw.knowledgeIngestText, nodeId, errors);
  return knowledgeIngestText ? { knowledgeIngestText } : {};
}

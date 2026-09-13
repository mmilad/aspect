import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgePromoteConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

function parseConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowKnowledgePromoteConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgePromote config must be an object.`);
    return undefined;
  }
  return {
    classificationFrom: optionalString(raw, "classificationFrom"),
    datasetKey: optionalString(raw, "datasetKey"),
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    textFrom: optionalString(raw, "textFrom"),
    metadataFrom: optionalString(raw, "metadataFrom"),
    scopeFrom: optionalString(raw, "scopeFrom"),
    confirmedFrom: optionalString(raw, "confirmedFrom"),
    ingestionIdFrom: optionalString(raw, "ingestionIdFrom"),
    sourceIdFrom: optionalString(raw, "sourceIdFrom")
  };
}

export function parseKnowledgePromoteNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgePromote = parseConfig(raw.knowledgePromote, nodeId, errors);
  return knowledgePromote ? { knowledgePromote } : {};
}

import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgeSearchConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

export function parseKnowledgeSearchConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowKnowledgeSearchConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgeSearch config must be an object.`);
    return undefined;
  }
  return {
    datasetKey: optionalString(raw, "datasetKey"),
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    queryFrom: optionalString(raw, "queryFrom"),
    topKFrom: optionalString(raw, "topKFrom"),
    keywordQueryFrom: optionalString(raw, "keywordQueryFrom"),
    metadataFiltersFrom: optionalString(raw, "metadataFiltersFrom"),
    vectorWeightFrom: optionalString(raw, "vectorWeightFrom"),
    accessFrom: optionalString(raw, "accessFrom")
  };
}

export function parseKnowledgeSearchNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgeSearch = parseKnowledgeSearchConfig(raw.knowledgeSearch, nodeId, errors);
  return knowledgeSearch ? { knowledgeSearch } : {};
}

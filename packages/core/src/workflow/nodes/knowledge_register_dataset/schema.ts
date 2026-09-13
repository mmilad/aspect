import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgeRegisterDatasetConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

function parseConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowKnowledgeRegisterDatasetConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgeRegisterDataset config must be an object.`);
    return undefined;
  }
  return {
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    displayNameFrom: optionalString(raw, "displayNameFrom"),
    schemaVersionFrom: optionalString(raw, "schemaVersionFrom"),
    semanticDescriptionFrom: optionalString(raw, "semanticDescriptionFrom"),
    usageGuidanceFrom: optionalString(raw, "usageGuidanceFrom"),
    llmSummaryFrom: optionalString(raw, "llmSummaryFrom"),
    contentKindFrom: optionalString(raw, "contentKindFrom"),
    retrievalCapabilitiesFrom: optionalString(raw, "retrievalCapabilitiesFrom"),
    capabilityTagsFrom: optionalString(raw, "capabilityTagsFrom"),
    entityTypesFrom: optionalString(raw, "entityTypesFrom"),
    filterableFieldsFrom: optionalString(raw, "filterableFieldsFrom"),
    metadataFrom: optionalString(raw, "metadataFrom")
  };
}

export function parseKnowledgeRegisterDatasetNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgeRegisterDataset = parseConfig(raw.knowledgeRegisterDataset, nodeId, errors);
  return knowledgeRegisterDataset ? { knowledgeRegisterDataset } : {};
}

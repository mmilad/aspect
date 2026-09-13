import { isRecord } from "../_shared/schema";
import type { WorkflowKnowledgeIndexProjectConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

function parseConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowKnowledgeIndexProjectConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} knowledgeIndexProject config must be an object.`);
    return undefined;
  }
  return {
    projectKey: optionalString(raw, "projectKey"),
    projectKeyFrom: optionalString(raw, "projectKeyFrom"),
    datasetKey: optionalString(raw, "datasetKey"),
    datasetKeyFrom: optionalString(raw, "datasetKeyFrom"),
    limitFrom: optionalString(raw, "limitFrom"),
    includeArchivedFrom: optionalString(raw, "includeArchivedFrom")
  };
}

export function parseKnowledgeIndexProjectNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const knowledgeIndexProject = parseConfig(raw.knowledgeIndexProject, nodeId, errors);
  return knowledgeIndexProject ? { knowledgeIndexProject } : {};
}

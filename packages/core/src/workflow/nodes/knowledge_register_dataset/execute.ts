import type { KnowledgeDatasetSpec } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, label);
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value.map((item) => (item as string).trim());
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

export async function executeKnowledgeRegisterDataset(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.knowledgeRegisterDataset;
  if (!adapter) return ctx.fail("Knowledge dataset registration is not configured.");
  const config = ctx.node.data.knowledgeRegisterDataset ?? {};
  try {
    const input: KnowledgeDatasetSpec = {
      datasetKey: requiredString(ctx.read(config.datasetKeyFrom ?? "datasetKey"), "datasetKey"),
      displayName: requiredString(ctx.read(config.displayNameFrom ?? "displayName"), "displayName"),
      schemaVersion: requiredString(ctx.read(config.schemaVersionFrom ?? "schemaVersion"), "schemaVersion"),
      semanticDescription: requiredString(ctx.read(config.semanticDescriptionFrom ?? "semanticDescription"), "semanticDescription"),
      usageGuidance: requiredString(ctx.read(config.usageGuidanceFrom ?? "usageGuidance"), "usageGuidance"),
      ...(optionalString(ctx.read(config.llmSummaryFrom ?? "llmSummary"), "llmSummary") ? { llmSummary: optionalString(ctx.read(config.llmSummaryFrom ?? "llmSummary"), "llmSummary") } : {}),
      ...(optionalString(ctx.read(config.contentKindFrom ?? "contentKind"), "contentKind") ? { contentKind: optionalString(ctx.read(config.contentKindFrom ?? "contentKind"), "contentKind") as KnowledgeDatasetSpec["contentKind"] } : {}),
      ...(optionalStringArray(ctx.read(config.retrievalCapabilitiesFrom ?? "retrievalCapabilities"), "retrievalCapabilities") ? { retrievalCapabilities: optionalStringArray(ctx.read(config.retrievalCapabilitiesFrom ?? "retrievalCapabilities"), "retrievalCapabilities") as KnowledgeDatasetSpec["retrievalCapabilities"] } : {}),
      ...(optionalStringArray(ctx.read(config.capabilityTagsFrom ?? "capabilityTags"), "capabilityTags") ? { capabilityTags: optionalStringArray(ctx.read(config.capabilityTagsFrom ?? "capabilityTags"), "capabilityTags") } : {}),
      ...(optionalStringArray(ctx.read(config.entityTypesFrom ?? "entityTypes"), "entityTypes") ? { entityTypes: optionalStringArray(ctx.read(config.entityTypesFrom ?? "entityTypes"), "entityTypes") } : {}),
      ...(optionalStringArray(ctx.read(config.filterableFieldsFrom ?? "filterableFields"), "filterableFields") ? { filterableFields: optionalStringArray(ctx.read(config.filterableFieldsFrom ?? "filterableFields"), "filterableFields") } : {}),
      ...(optionalRecord(ctx.read(config.metadataFrom ?? "metadata"), "metadata") ? { metadata: optionalRecord(ctx.read(config.metadataFrom ?? "metadata"), "metadata") } : {})
    };
    const record = await adapter(input);
    const applied = ctx.applyWrites({
      datasetKey: record.datasetKey,
      registered: true,
      displayName: record.displayName,
      schemaVersion: record.schemaVersion
    });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge dataset registration failed.");
  }
}

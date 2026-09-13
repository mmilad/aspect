import { knowledgeScopeError, type KnowledgeIngestInput, type KnowledgeScope } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export async function executeKnowledgeIngest(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.knowledgeIngest;
  if (!adapter) return ctx.fail("Knowledge ingest is not configured.");
  const config = ctx.node.data.knowledgeIngest ?? {};
  const datasetKey = requiredString(config.datasetKey) ?? requiredString(ctx.read(config.datasetKeyFrom ?? "datasetKey"));
  if (!datasetKey) return ctx.fail(`Knowledge ingest ${ctx.node.id}: datasetKey must be a non-empty string.`);
  const rawText = requiredString(ctx.read(config.rawTextFrom ?? "rawText"));
  if (!rawText) return ctx.fail(`Knowledge ingest ${ctx.node.id}: rawText must be a non-empty string.`);

  const rawMetadata = ctx.read(config.metadataFrom ?? "metadata");
  const metadata = rawMetadata === undefined || rawMetadata === null ? undefined : recordValue(rawMetadata);
  if (rawMetadata !== undefined && rawMetadata !== null && !metadata) {
    return ctx.fail(`Knowledge ingest ${ctx.node.id}: metadata must be an object when provided.`);
  }
  const rawScope = ctx.read(config.scopeFrom ?? "scope");
  if (rawScope === undefined || rawScope === null) {
    return ctx.fail(`Knowledge ingest ${ctx.node.id}: an explicit scope is required.`);
  }
  const scope = rawScope === undefined || rawScope === null ? undefined : recordValue(rawScope) as KnowledgeScope | undefined;
  const scopeError = knowledgeScopeError(scope);
  if (scopeError) return ctx.fail(`Knowledge ingest ${ctx.node.id}: ${scopeError}`);
  const itemId = requiredString(ctx.read(config.itemIdFrom ?? "itemId"));
  const input: KnowledgeIngestInput = {
    datasetKey,
    items: [{
      ...(itemId ? { id: itemId } : {}),
      rawText,
      ...(metadata ? { metadata } : {}),
      scope
    }]
  };
  try {
    const response = await adapter(input);
    const applied = ctx.applyWrites({
      ingested: response.ingested,
      ids: response.ids,
      embeddingModel: response.embeddingModel ?? null
    });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge ingest failed.");
  }
}

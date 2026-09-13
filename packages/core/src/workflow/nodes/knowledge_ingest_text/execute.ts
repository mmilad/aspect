import type { KnowledgeIngestTextInput, KnowledgeScope } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function optionalInteger(value: unknown, label: string, min: number, max?: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    throw new Error(`${label} must be an integer${max === undefined ? ` >= ${min}` : ` between ${min} and ${max}`}.`);
  }
  return parsed;
}

export async function executeKnowledgeIngestText(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.knowledgeIngestText;
  if (!adapter) return ctx.fail("Knowledge text ingest is not configured.");
  const config = ctx.node.data.knowledgeIngestText ?? {};
  const datasetKey = requiredString(config.datasetKey) ?? requiredString(ctx.read(config.datasetKeyFrom ?? "datasetKey"));
  const text = requiredString(ctx.read(config.textFrom ?? "text"));
  if (!datasetKey) return ctx.fail(`Knowledge text ingest ${ctx.node.id}: datasetKey must be a non-empty string.`);
  if (!text) return ctx.fail(`Knowledge text ingest ${ctx.node.id}: text must be a non-empty string.`);

  const rawMetadata = ctx.read(config.metadataFrom ?? "metadata");
  const metadata = rawMetadata === undefined || rawMetadata === null ? undefined : recordValue(rawMetadata);
  if (rawMetadata !== undefined && rawMetadata !== null && !metadata) return ctx.fail(`Knowledge text ingest ${ctx.node.id}: metadata must be an object.`);
  const rawScope = ctx.read(config.scopeFrom ?? "scope");
  const scope = rawScope === undefined || rawScope === null ? undefined : recordValue(rawScope) as KnowledgeScope | undefined;
  if (rawScope !== undefined && rawScope !== null && !scope) return ctx.fail(`Knowledge text ingest ${ctx.node.id}: scope must be an object.`);

  try {
    const ingestionId = requiredString(ctx.read(config.ingestionIdFrom ?? "ingestionId"));
    const processorStrategy = requiredString(ctx.read(config.processorStrategyFrom ?? "processorStrategy"));
    const rawExtractPrimitives = ctx.read(config.extractPrimitivesFrom ?? "extractPrimitives");
    const extractPrimitives = rawExtractPrimitives === undefined || rawExtractPrimitives === null || rawExtractPrimitives === ""
      ? undefined
      : rawExtractPrimitives === true || rawExtractPrimitives === "true"
        ? true
        : rawExtractPrimitives === false || rawExtractPrimitives === "false"
          ? false
          : (() => { throw new Error("extractPrimitives must be a boolean."); })();
    const maxChars = optionalInteger(ctx.read(config.maxCharsFrom ?? "maxChars"), "maxChars", 1);
    const overlapChars = optionalInteger(ctx.read(config.overlapCharsFrom ?? "overlapChars"), "overlapChars", 0);
    const batchSize = optionalInteger(ctx.read(config.batchSizeFrom ?? "batchSize"), "batchSize", 1, 500);
    const input: KnowledgeIngestTextInput = {
      datasetKey,
      text,
      ...(metadata ? { metadata } : {}),
      ...(scope ? { scope } : {}),
      ...(ingestionId ? { ingestionId } : {}),
      ...(processorStrategy ? { processorStrategy } : {}),
      ...(extractPrimitives === undefined ? {} : { extractPrimitives }),
      ...(maxChars === undefined ? {} : { maxChars }),
      ...(overlapChars === undefined ? {} : { overlapChars }),
      ...(batchSize === undefined ? {} : { batchSize })
    };
    const response = await adapter(input);
    const applied = ctx.applyWrites({ ingested: response.ingested, ids: response.ids, embeddingModel: response.embeddingModel ?? null });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge text ingest failed.");
  }
}

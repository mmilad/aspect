import { knowledgeScopeError, type KnowledgeIngestTextInput, type KnowledgeScope } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

async function output(ctx: NodeExecuteContext, values: Record<string, unknown>): Promise<WorkflowStepResult> {
  const applied = ctx.applyWrites(values);
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

export async function executeKnowledgePromote(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const config = ctx.node.data.knowledgePromote ?? {};
  const classification = recordValue(ctx.read(config.classificationFrom ?? "classification"));
  if (!classification) return ctx.fail(`Knowledge promotion ${ctx.node.id}: classification must be an object.`);

  const decision = requiredString(classification.decision);
  if (decision !== "ignore" && decision !== "candidate" && decision !== "durable") {
    return ctx.fail(`Knowledge promotion ${ctx.node.id}: classification.decision must be ignore, candidate, or durable.`);
  }

  if (decision === "ignore") {
    return output(ctx, { status: "ignored", reason: "The classification marked this source as not worth retaining.", ingested: 0, ids: [], embeddingModel: null });
  }

  const confirmed = ctx.read(config.confirmedFrom ?? "confirmed") === true;
  if (!confirmed) {
    return output(ctx, {
      status: "needs_confirmation",
      reason: "Explicit confirmation is required before storing this knowledge.",
      ingested: 0,
      ids: [],
      embeddingModel: null
    });
  }

  const adapter = ctx.adapters.knowledgeIngestText;
  if (!adapter) return ctx.fail("Knowledge promotion is not configured: text ingest is unavailable.");

  const datasetKey = requiredString(config.datasetKey) ?? requiredString(ctx.read(config.datasetKeyFrom ?? "datasetKey"));
  const text = requiredString(ctx.read(config.textFrom ?? "canonicalText")) ?? requiredString(classification.canonicalText);
  const scope = recordValue(ctx.read(config.scopeFrom ?? "scope")) as KnowledgeScope | undefined;
  const rawMetadata = ctx.read(config.metadataFrom ?? "metadata");
  const metadata = rawMetadata === undefined || rawMetadata === null ? {} : recordValue(rawMetadata);
  const sourceId = requiredString(ctx.read(config.sourceIdFrom ?? "sourceId"));
  const ingestionId = requiredString(ctx.read(config.ingestionIdFrom ?? "ingestionId")) ?? (sourceId ? `projectplaner:memory:${sourceId}` : undefined);

  if (!datasetKey) return ctx.fail(`Knowledge promotion ${ctx.node.id}: datasetKey must be a non-empty string.`);
  if (!text) return ctx.fail(`Knowledge promotion ${ctx.node.id}: canonicalText must be a non-empty string.`);
  if (!scope || !requiredString(scope.kind)) return ctx.fail(`Knowledge promotion ${ctx.node.id}: an explicit scope is required.`);
  const scopeError = knowledgeScopeError(scope);
  if (scopeError) return ctx.fail(`Knowledge promotion ${ctx.node.id}: ${scopeError}`);
  if (rawMetadata !== undefined && rawMetadata !== null && !metadata) return ctx.fail(`Knowledge promotion ${ctx.node.id}: metadata must be an object.`);
  if (!ingestionId) return ctx.fail(`Knowledge promotion ${ctx.node.id}: ingestionId or sourceId is required for idempotent storage.`);

  const input: KnowledgeIngestTextInput = {
    datasetKey,
    text,
    scope,
    ingestionId,
    metadata: {
      ...(metadata ?? {}),
      source: "projectplaner:knowledge_promote",
      memoryRole: decision === "durable" ? "durable_fact" : "candidate",
      kind: requiredString(classification.kind) ?? "other",
      ...(typeof classification.confidence === "number" ? { confidence: classification.confidence } : {}),
      ...(requiredString(classification.sourceQuote) ? { sourceQuote: requiredString(classification.sourceQuote) } : {}),
      ...(sourceId ? { sourceId } : {})
    }
  };

  try {
    const response = await adapter(input);
    return output(ctx, {
      status: "promoted",
      reason: decision === "durable" ? "Confirmed durable knowledge was stored." : "Confirmed candidate knowledge was stored.",
      ingested: response.ingested,
      ids: response.ids,
      embeddingModel: response.embeddingModel ?? null
    });
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge promotion failed.");
  }
}

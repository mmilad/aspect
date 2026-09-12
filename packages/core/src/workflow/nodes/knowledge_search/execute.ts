import type { KnowledgeAccess, KnowledgeSearchInput } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export async function executeKnowledgeSearch(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.knowledgeSearch;
  if (!adapter) return ctx.fail("Knowledge search is not configured.");

  const config = ctx.node.data.knowledgeSearch ?? {};
  const datasetKey = optionalString(config.datasetKey) ?? optionalString(ctx.read(config.datasetKeyFrom ?? "datasetKey"));
  if (!datasetKey) return ctx.fail(`Knowledge search ${ctx.node.id}: datasetKey must be a non-empty string.`);

  const query = optionalString(ctx.read(config.queryFrom ?? "query"));
  if (!query) return ctx.fail(`Knowledge search ${ctx.node.id}: query must be a non-empty string.`);

  const rawTopK = ctx.read(config.topKFrom ?? "topK");
  const topK = rawTopK === undefined || rawTopK === null ? 10 : Number(rawTopK);
  if (!Number.isInteger(topK) || topK < 1 || topK > 100) {
    return ctx.fail(`Knowledge search ${ctx.node.id}: topK must be an integer between 1 and 100.`);
  }

  const rawKeywordQuery = ctx.read(config.keywordQueryFrom ?? "keywordQuery");
  const keywordQuery = rawKeywordQuery === undefined || rawKeywordQuery === null
    ? undefined
    : optionalString(rawKeywordQuery);
  if (rawKeywordQuery !== undefined && rawKeywordQuery !== null && keywordQuery === undefined) {
    return ctx.fail(`Knowledge search ${ctx.node.id}: keywordQuery must be a string when provided.`);
  }

  const rawFilters = ctx.read(config.metadataFiltersFrom ?? "metadataFilters");
  const metadataFilters = rawFilters === undefined || rawFilters === null ? undefined : recordValue(rawFilters);
  if (rawFilters !== undefined && rawFilters !== null && !metadataFilters) {
    return ctx.fail(`Knowledge search ${ctx.node.id}: metadataFilters must be an object when provided.`);
  }

  const rawVectorWeight = ctx.read(config.vectorWeightFrom ?? "vectorWeight");
  const vectorWeight = rawVectorWeight === undefined || rawVectorWeight === null ? undefined : Number(rawVectorWeight);
  if (vectorWeight !== undefined && (!Number.isFinite(vectorWeight) || vectorWeight < 0 || vectorWeight > 1)) {
    return ctx.fail(`Knowledge search ${ctx.node.id}: vectorWeight must be between 0 and 1.`);
  }

  const rawAccess = ctx.read(config.accessFrom ?? "access");
  const access = rawAccess === undefined || rawAccess === null ? undefined : recordValue(rawAccess) as KnowledgeAccess | undefined;
  if (rawAccess !== undefined && rawAccess !== null && !access) {
    return ctx.fail(`Knowledge search ${ctx.node.id}: access must be an object when provided.`);
  }

  const input: KnowledgeSearchInput = {
    datasetKey,
    query,
    topK,
    ...(keywordQuery ? { keywordQuery } : {}),
    ...(metadataFilters ? { metadataFilters } : {}),
    ...(vectorWeight !== undefined ? { vectorWeight } : {}),
    ...(access ? { access } : {})
  };

  try {
    const response = await adapter(input);
    const applied = ctx.applyWrites({
      hits: response.hits,
      query: response.query,
      embeddingModel: response.embeddingModel ?? null,
      totalSearched: response.totalSearched,
      searchMode: response.searchMode
    });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge search failed.");
  }
}

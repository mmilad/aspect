import type {
  KnowledgeAccess,
  KnowledgeScope,
  KnowledgeSearchHit,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  WorkflowAdapters
} from "@projectplaner/core";

type KnowledgeSearchProvider = NonNullable<WorkflowAdapters["knowledgeSearch"]>;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Knowledge search returned an invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function optionalNumber(value: unknown): number | null | undefined {
  return typeof value === "number" ? value : value === null ? null : undefined;
}

function normalizeScope(value: unknown): KnowledgeScope {
  const raw = asRecord(value ?? {}, "scope");
  return {
    kind: typeof raw.kind === "string" ? raw.kind as KnowledgeScope["kind"] : "global",
    ...(typeof raw.owner_id === "string" ? { ownerId: raw.owner_id } : {}),
    ...(typeof raw.project_key === "string" ? { projectKey: raw.project_key } : {}),
    ...(typeof raw.agent_id === "string" ? { agentId: raw.agent_id } : {}),
    ...(typeof raw.session_id === "string" ? { sessionId: raw.session_id } : {}),
    ...(typeof raw.source_id === "string" ? { sourceId: raw.source_id } : {})
  };
}

function normalizeHit(value: unknown): KnowledgeSearchHit {
  const hit = asRecord(value, "hit");
  const item = asRecord(hit.item, "memory item");
  if (typeof item.id !== "string" || typeof item.dataset_key !== "string" || typeof item.raw_text !== "string") {
    throw new Error("Knowledge search returned a memory item without id, dataset_key, or raw_text.");
  }
  const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? item.metadata as Record<string, unknown>
    : {};
  if (typeof hit.score !== "number") throw new Error("Knowledge search returned a hit without a numeric score.");
  return {
    id: item.id,
    datasetKey: item.dataset_key,
    rawText: item.raw_text,
    metadata,
    scope: normalizeScope(item.scope),
    score: hit.score,
    vectorScore: optionalNumber(hit.vector_score),
    keywordScore: optionalNumber(hit.keyword_score),
    embeddingModel: typeof item.embedding_model === "string" ? item.embedding_model : null
  };
}

function toApiAccess(access: KnowledgeAccess | undefined): Record<string, unknown> | undefined {
  if (!access) return undefined;
  return {
    ...(access.principalId ? { principal_id: access.principalId } : {}),
    ...(access.projectKey ? { project_key: access.projectKey } : {}),
    ...(access.agentId ? { agent_id: access.agentId } : {}),
    ...(access.sessionId ? { session_id: access.sessionId } : {}),
    ...(access.includeGlobal === undefined ? {} : { include_global: access.includeGlobal })
  };
}

/** HTTP adapter for CortexDB's read-only memory search endpoint. */
export function createKnowledgeSearchProvider(endpoint: string): KnowledgeSearchProvider {
  const base = endpoint.replace(/\/$/, "");
  return async (input: KnowledgeSearchInput): Promise<KnowledgeSearchResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const access = toApiAccess(input.access);
      const response = await fetch(`${base}/datasets/${encodeURIComponent(input.datasetKey)}/search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query: input.query,
          top_k: input.topK ?? 10,
          ...(input.keywordQuery ? { keyword_query: input.keywordQuery } : {}),
          ...(input.metadataFilters ? { metadata_filters: input.metadataFilters } : {}),
          ...(input.vectorWeight === undefined ? {} : { vector_weight: input.vectorWeight }),
          ...(access ? { access } : {})
        })
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Knowledge search provider returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
      }
      const payload = asRecord(await response.json(), "response");
      if (!Array.isArray(payload.hits) || typeof payload.query !== "string" || typeof payload.total_searched !== "number" || typeof payload.search_mode !== "string") {
        throw new Error("Knowledge search returned an invalid response shape.");
      }
      return {
        hits: payload.hits.map(normalizeHit),
        query: payload.query,
        embeddingModel: typeof payload.embedding_model === "string" ? payload.embedding_model : null,
        totalSearched: payload.total_searched,
        searchMode: payload.search_mode
      };
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Knowledge search timed out after 15 seconds.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createConfiguredKnowledgeSearchProvider(projectKey: string): KnowledgeSearchProvider | undefined {
  const endpoint = process.env.PROJECTPLANER_KNOWLEDGE_URL ?? process.env.CORTEXDB_URL;
  if (!endpoint) return undefined;
  const provider = createKnowledgeSearchProvider(endpoint);
  return (input) => provider({
    ...input,
    access: { projectKey, includeGlobal: true, ...input.access }
  });
}

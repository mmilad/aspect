import type {
  KnowledgeDatasetRecord,
  KnowledgeDatasetSpec,
  KnowledgeAccess,
  KnowledgeGetInput,
  KnowledgeGetResult,
  KnowledgeIngestInput,
  KnowledgeIngestResult,
  KnowledgeIngestTextInput,
  KnowledgeItem,
  KnowledgeScope,
  KnowledgeSearchHit,
  KnowledgeSearchInput,
  KnowledgeSearchResult,
  WorkflowAdapters
} from "@projectplaner/core";

type KnowledgeSearchProvider = NonNullable<WorkflowAdapters["knowledgeSearch"]>;
type KnowledgeRegisterDatasetProvider = NonNullable<WorkflowAdapters["knowledgeRegisterDataset"]>;

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

function normalizeDataset(value: unknown): KnowledgeDatasetRecord {
  const raw = asRecord(value, "dataset");
  if (
    typeof raw.dataset_key !== "string" ||
    typeof raw.display_name !== "string" ||
    typeof raw.schema_version !== "string" ||
    typeof raw.semantic_description !== "string" ||
    typeof raw.usage_guidance !== "string"
  ) {
    throw new Error("Knowledge dataset response is missing its required metadata.");
  }
  const strings = (key: string): string[] | undefined => {
    const value = raw[key];
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value as string[] : undefined;
  };
  const metadata = raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
    ? raw.metadata as Record<string, unknown>
    : undefined;
  return {
    datasetKey: raw.dataset_key,
    displayName: raw.display_name,
    schemaVersion: raw.schema_version,
    semanticDescription: raw.semantic_description,
    usageGuidance: raw.usage_guidance,
    ...(typeof raw.llm_summary === "string" ? { llmSummary: raw.llm_summary } : {}),
    ...(raw.content_kind === "documents" || raw.content_kind === "events" || raw.content_kind === "custom" ? { contentKind: raw.content_kind } : {}),
    ...(strings("retrieval_capabilities") ? { retrievalCapabilities: strings("retrieval_capabilities") as KnowledgeDatasetRecord["retrievalCapabilities"] } : {}),
    ...(strings("capability_tags") ? { capabilityTags: strings("capability_tags") } : {}),
    ...(strings("entity_types") ? { entityTypes: strings("entity_types") } : {}),
    ...(strings("filterable_fields") ? { filterableFields: strings("filterable_fields") } : {}),
    ...(metadata ? { metadata } : {}),
    ...(typeof raw.status === "string" ? { status: raw.status } : {}),
    ...(typeof raw.created_at === "string" ? { createdAt: raw.created_at } : {}),
    ...(typeof raw.updated_at === "string" ? { updatedAt: raw.updated_at } : {})
  };
}

function normalizeItem(value: unknown): KnowledgeItem {
  const item = asRecord(value, "memory item");
  if (typeof item.id !== "string" || typeof item.dataset_key !== "string" || typeof item.raw_text !== "string") {
    throw new Error("Knowledge search returned a memory item without id, dataset_key, or raw_text.");
  }
  const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
    ? item.metadata as Record<string, unknown>
    : {};
  return {
    id: item.id,
    datasetKey: item.dataset_key,
    rawText: item.raw_text,
    metadata,
    scope: normalizeScope(item.scope),
    embeddingModel: typeof item.embedding_model === "string" ? item.embedding_model : null,
    createdAt: typeof item.created_at === "string" ? item.created_at : null,
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
    isDeleted: typeof item.is_deleted === "boolean" ? item.is_deleted : false
  };
}

function normalizeHit(value: unknown): KnowledgeSearchHit {
  const hit = asRecord(value, "hit");
  const item = normalizeItem(hit.item);
  if (typeof hit.score !== "number") throw new Error("Knowledge search returned a hit without a numeric score.");
  return {
    id: item.id,
    datasetKey: item.datasetKey,
    rawText: item.rawText,
    metadata: item.metadata,
    scope: item.scope,
    score: hit.score,
    vectorScore: optionalNumber(hit.vector_score),
    keywordScore: optionalNumber(hit.keyword_score),
    embeddingModel: item.embeddingModel
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

type KnowledgeGetProvider = NonNullable<WorkflowAdapters["knowledgeGet"]>;
type KnowledgeIngestProvider = NonNullable<WorkflowAdapters["knowledgeIngest"]>;
type KnowledgeIngestTextProvider = NonNullable<WorkflowAdapters["knowledgeIngestText"]>;

/** HTTP adapter for CortexDB's idempotent dataset registration endpoint. */
export function createKnowledgeRegisterDatasetProvider(endpoint: string): KnowledgeRegisterDatasetProvider {
  const base = endpoint.replace(/\/$/, "");
  return async (input: KnowledgeDatasetSpec): Promise<KnowledgeDatasetRecord> => {
    const response = await fetch(`${base}/datasets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataset_key: input.datasetKey,
        display_name: input.displayName,
        schema_version: input.schemaVersion,
        semantic_description: input.semanticDescription,
        usage_guidance: input.usageGuidance,
        ...(input.llmSummary ? { llm_summary: input.llmSummary } : {}),
        ...(input.contentKind ? { content_kind: input.contentKind } : {}),
        ...(input.retrievalCapabilities ? { retrieval_capabilities: input.retrievalCapabilities } : {}),
        ...(input.capabilityTags ? { capability_tags: input.capabilityTags } : {}),
        ...(input.entityTypes ? { entity_types: input.entityTypes } : {}),
        ...(input.filterableFields ? { filterable_fields: input.filterableFields } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {})
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Knowledge dataset registration returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
    }
    return normalizeDataset(await response.json());
  };
}

export function createKnowledgeGetProvider(endpoint: string): KnowledgeGetProvider {
  const base = endpoint.replace(/\/$/, "");
  return async (input: KnowledgeGetInput): Promise<KnowledgeGetResult> => {
    const url = new URL(`${base}/datasets/${encodeURIComponent(input.datasetKey)}/items/${encodeURIComponent(input.itemId)}`);
    if (input.includeDeleted) url.searchParams.set("include_deleted", "true");
    const access = toApiAccess(input.access);
    for (const [key, value] of Object.entries(access ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, { headers: { "content-type": "application/json" } });
    if (response.status === 404) return { item: null };
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Knowledge get provider returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
    }
    return { item: normalizeItem(await response.json()) };
  };
}

function toApiScope(scope: KnowledgeScope | undefined): Record<string, unknown> {
  const value = scope ?? { kind: "global" as const };
  return {
    kind: value.kind,
    ...(value.ownerId ? { owner_id: value.ownerId } : {}),
    ...(value.projectKey ? { project_key: value.projectKey } : {}),
    ...(value.agentId ? { agent_id: value.agentId } : {}),
    ...(value.sessionId ? { session_id: value.sessionId } : {}),
    ...(value.sourceId ? { source_id: value.sourceId } : {})
  };
}

export function createKnowledgeIngestProvider(endpoint: string): KnowledgeIngestProvider {
  const base = endpoint.replace(/\/$/, "");
  return async (input: KnowledgeIngestInput): Promise<KnowledgeIngestResult> => {
    const response = await fetch(`${base}/datasets/${encodeURIComponent(input.datasetKey)}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: input.items.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          raw_text: item.rawText,
          metadata: item.metadata ?? {},
          scope: toApiScope(item.scope)
        }))
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Knowledge ingest provider returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
    }
    const payload = asRecord(await response.json(), "ingest response");
    if (typeof payload.ingested !== "number" || !Array.isArray(payload.ids) || payload.ids.some((id) => typeof id !== "string")) {
      throw new Error("Knowledge ingest returned an invalid response shape.");
    }
    return {
      ingested: payload.ingested,
      ids: payload.ids as string[],
      embeddingModel: typeof payload.embedding_model === "string" ? payload.embedding_model : null
    };
  };
}

/** HTTP adapter for CortexDB's text chunking and ingest endpoint. */
export function createKnowledgeIngestTextProvider(endpoint: string): KnowledgeIngestTextProvider {
  const base = endpoint.replace(/\/$/, "");
  return async (input: KnowledgeIngestTextInput): Promise<KnowledgeIngestResult> => {
    const response = await fetch(`${base}/datasets/${encodeURIComponent(input.datasetKey)}/ingest/text`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        metadata: input.metadata ?? {},
        scope: toApiScope(input.scope),
        ...(input.maxChars === undefined ? {} : { max_chars: input.maxChars }),
        ...(input.overlapChars === undefined ? {} : { overlap_chars: input.overlapChars }),
        ...(input.ingestionId === undefined ? {} : { ingestion_id: input.ingestionId }),
        ...(input.batchSize === undefined ? {} : { batch_size: input.batchSize }),
        ...(input.processorStrategy === undefined ? {} : { processor_strategy: input.processorStrategy }),
        ...(input.extractPrimitives === undefined ? {} : { extract_primitives: input.extractPrimitives })
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Knowledge text ingest provider returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
    }
    const payload = asRecord(await response.json(), "text ingest response");
    if (typeof payload.ingested !== "number" || !Array.isArray(payload.ids) || payload.ids.some((id) => typeof id !== "string")) {
      throw new Error("Knowledge text ingest returned an invalid response shape.");
    }
    return {
      ingested: payload.ingested,
      ids: payload.ids as string[],
      embeddingModel: typeof payload.embedding_model === "string" ? payload.embedding_model : null
    };
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

export function createConfiguredKnowledgeGetProvider(projectKey: string): KnowledgeGetProvider | undefined {
  const endpoint = process.env.PROJECTPLANER_KNOWLEDGE_URL ?? process.env.CORTEXDB_URL;
  if (!endpoint) return undefined;
  const provider = createKnowledgeGetProvider(endpoint);
  return (input) => provider({
    ...input,
    access: { projectKey, includeGlobal: true, ...input.access }
  });
}

export function createConfiguredKnowledgeIngestProvider(): KnowledgeIngestProvider | undefined {
  const endpoint = process.env.PROJECTPLANER_KNOWLEDGE_URL ?? process.env.CORTEXDB_URL;
  return endpoint ? createKnowledgeIngestProvider(endpoint) : undefined;
}

export function createConfiguredKnowledgeIngestTextProvider(): KnowledgeIngestTextProvider | undefined {
  const endpoint = process.env.PROJECTPLANER_KNOWLEDGE_URL ?? process.env.CORTEXDB_URL;
  return endpoint ? createKnowledgeIngestTextProvider(endpoint) : undefined;
}

export function createConfiguredKnowledgeRegisterDatasetProvider(): KnowledgeRegisterDatasetProvider | undefined {
  const endpoint = process.env.PROJECTPLANER_KNOWLEDGE_URL ?? process.env.CORTEXDB_URL;
  return endpoint ? createKnowledgeRegisterDatasetProvider(endpoint) : undefined;
}

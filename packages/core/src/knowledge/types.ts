/** Scope metadata shared by Projectplaner and the CortexDB knowledge service. */
export type KnowledgeScopeKind = "global" | "personal" | "project" | "agent" | "session";

export interface KnowledgeScope {
  kind: KnowledgeScopeKind;
  ownerId?: string;
  projectKey?: string;
  agentId?: string;
  sessionId?: string;
  sourceId?: string;
}

export interface KnowledgeAccess {
  principalId?: string;
  projectKey?: string;
  agentId?: string;
  sessionId?: string;
  includeGlobal?: boolean;
}

export interface KnowledgeSearchInput {
  datasetKey: string;
  query: string;
  topK?: number;
  keywordQuery?: string;
  metadataFilters?: Record<string, unknown>;
  vectorWeight?: number;
  access?: KnowledgeAccess;
}

export interface KnowledgeItem {
  id: string;
  datasetKey: string;
  rawText: string;
  metadata: Record<string, unknown>;
  scope: KnowledgeScope;
  embeddingModel?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isDeleted?: boolean;
}

export interface KnowledgeGetInput {
  datasetKey: string;
  itemId: string;
  includeDeleted?: boolean;
  access?: KnowledgeAccess;
}

export interface KnowledgeGetResult {
  item: KnowledgeItem | null;
}

export interface KnowledgeIngestItem {
  id?: string;
  rawText: string;
  metadata?: Record<string, unknown>;
  scope?: KnowledgeScope;
}

export interface KnowledgeIngestInput {
  datasetKey: string;
  items: KnowledgeIngestItem[];
}

export interface KnowledgeIngestResult {
  ingested: number;
  ids: string[];
  embeddingModel?: string | null;
}

export interface KnowledgeIngestTextInput {
  datasetKey: string;
  text: string;
  metadata?: Record<string, unknown>;
  scope?: KnowledgeScope;
  maxChars?: number;
  overlapChars?: number;
  ingestionId?: string;
  batchSize?: number;
  processorStrategy?: string;
  extractPrimitives?: boolean;
}

export interface KnowledgeSearchHit {
  id: string;
  datasetKey: string;
  rawText: string;
  metadata: Record<string, unknown>;
  scope: KnowledgeScope;
  score: number;
  vectorScore?: number | null;
  keywordScore?: number | null;
  embeddingModel?: string | null;
}

export interface KnowledgeSearchResult {
  hits: KnowledgeSearchHit[];
  query: string;
  embeddingModel?: string | null;
  totalSearched: number;
  searchMode: string;
}

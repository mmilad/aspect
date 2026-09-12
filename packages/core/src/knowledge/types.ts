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

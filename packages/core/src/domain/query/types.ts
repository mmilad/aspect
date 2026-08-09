import type { EntityRelationType, EntityStatus, EntityType, TaskPriority } from "../types";
import type { EntityNarrative } from "../narrative";

export type EntitySelectMode = "compact" | "full";

export type EntityOrderField = "sortOrder" | "title" | "status";

export type EntityOrderBy = {
  field: EntityOrderField;
  dir?: "asc" | "desc";
};

export type NamedPredicate = "unblocked" | "task_candidate";

export type EntityFieldName = "id" | "type" | "status" | "key" | "slug" | "title";

export type NarrativeTextField =
  | "metadata.narrative.reason"
  | "metadata.narrative.proposal"
  | "metadata.narrative.intent";

export type FieldFilter =
  | {
      field: EntityFieldName;
      op: "eq" | "in" | "neq";
      value: string | string[] | EntityType | EntityType[] | EntityStatus | EntityStatus[];
    }
  | { field: "q"; op: "match"; value: string }
  | {
      field: "metadata.priority";
      op: "eq" | "in";
      value: TaskPriority | TaskPriority[];
    }
  | { field: "metadata.disabled"; op: "eq"; value: boolean }
  | { field: NarrativeTextField; op: "eq" | "match"; value: string };

export type RelationFilter = {
  direction: "out" | "in" | "either";
  types?: EntityRelationType[];
  /** At least one related entity matches */
  some?: EntityFilter;
  /** No related entities (optionally matching nested filter) */
  none?: true | EntityFilter;
  /** All related entities match */
  every?: EntityFilter;
  /** v1: depth 1 only */
  depth?: 1;
};

export type EntityFilter =
  | FieldFilter
  | { rel: RelationFilter }
  | { pred: NamedPredicate }
  | { and: EntityFilter[] }
  | { or: EntityFilter[] }
  | { not: EntityFilter };

export type EntityListQuery = {
  projectKey?: string;
  where?: EntityFilter;
  orderBy?: EntityOrderBy[];
  limit?: number;
  offset?: number;
  select?: EntitySelectMode;
  /** When select is compact, still attach metadata.narrative */
  includeNarrative?: boolean;
  /** Include soft-deleted (`status=archived`) entities (default false). */
  includeArchived?: boolean;
};

export type EntitySearchQuery = {
  projectKey?: string;
  q: string;
  where?: EntityFilter;
  limit?: number;
  select?: EntitySelectMode;
  includeNarrative?: boolean;
  /** Exclude orientation packet references from the search pool (default true). */
  excludeOrientationPackets?: boolean;
  /** Include soft-deleted (`status=archived`) entities (default false). */
  includeArchived?: boolean;
};

export type RelatedToSugar = {
  id: string;
  types?: EntityRelationType[];
  direction?: "out" | "in" | "either";
};

export type TaskListQuery = EntityListQuery & {
  unblocked?: boolean;
  relatedTo?: RelatedToSugar;
  priority?: TaskPriority | TaskPriority[];
};

export type TaskNextWorkQuery = {
  projectKey?: string;
  relatedTo?: RelatedToSugar;
  limit?: number;
  select?: EntitySelectMode;
  includeNarrative?: boolean;
  /** Include soft-deleted (`status=archived`) entities (default false). */
  includeArchived?: boolean;
};

export type CompiledPredicate =
  | { kind: "true" }
  | {
      kind: "field";
      field: EntityFieldName | "metadata.priority" | "metadata.disabled" | NarrativeTextField;
      op: "eq" | "in" | "neq" | "match";
      value: unknown;
    }
  | { kind: "match"; value: string }
  | {
      kind: "rel";
      direction: "out" | "in" | "either";
      types?: EntityRelationType[];
      quantifier: "some" | "none" | "every";
      relatedWhere?: CompiledPredicate;
    }
  | { kind: "and"; items: CompiledPredicate[] }
  | { kind: "or"; items: CompiledPredicate[] }
  | { kind: "not"; item: CompiledPredicate };

export type QueryPlan = {
  projectKey: string;
  where: CompiledPredicate;
  /** Expanded EntityFilter used for meta.applied (null when unconstrained). */
  applied: EntityFilter | null;
  orderBy: EntityOrderBy[];
  limit?: number;
  offset?: number;
  select: EntitySelectMode;
};

export type CompactEntityView = {
  id: string;
  type: EntityType;
  key: string | null;
  title: string;
  status: EntityStatus;
  summary: string;
  narrative?: EntityNarrative;
};

export type RetrievalMode = "filter" | "relevance" | "work";

export type ListMeta = {
  projectKey: string;
  select: EntitySelectMode;
  mode: RetrievalMode;
  applied: EntityFilter | null;
  query?: string;
  limit?: number;
  offset?: number;
};

export type ListResult<T> = {
  items: T[];
  meta: ListMeta;
};

export type RankedItem<T> = T & { score: number };

export type RankedListResult<T> = {
  items: RankedItem<T>[];
  meta: ListMeta;
};

import type { Entity, EntityRelationType, EntityStatus, EntityType, JsonRecord } from "@projectplaner/core";
export interface CreateEntityInput {
  projectKey: string;
  type: EntityType;
  title: string;
  key?: string | null;
  slug?: string;
  summary?: string;
  body?: string;
  status?: EntityStatus;
  sortOrder?: number;
  metadata?: JsonRecord;
  relations?: Array<{
    targetEntityId: string;
    type: EntityRelationType;
    label?: string | null;
    isPrimary?: boolean;
    metadata?: JsonRecord;
  }>;
  /** Skip parent status rollup after create. */
  skipRollup?: boolean;
}
export interface UpdateEntityInput {
  id: string;
  patch: Partial<Pick<Entity, "key" | "slug" | "title" | "summary" | "body" | "status" | "sortOrder" | "metadata">>;
  /** Skip parent status rollup (used by rollup itself). */
  skipRollup?: boolean;
}
export interface EntityQuery {
  projectKey?: string;
  type?: EntityType;
  query?: string;
  /** Include soft-deleted (`status=archived`) entities (default false). */
  includeArchived?: boolean;
}
export interface Operations {
  create(input: CreateEntityInput): Promise<{
    entity: Entity;
    warnings: string[];
  }>;
  get(id: string): Promise<Entity | null>;
  list(query?: EntityQuery): Promise<Entity[]>;
  update(input: UpdateEntityInput): Promise<Entity>;
  remove(id: string): Promise<void>;
}

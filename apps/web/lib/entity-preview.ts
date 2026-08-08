import type { EntityType, EntityStatus, JsonRecord } from "@projectplaner/core";

/** Lightweight entity chrome shared by inspector, graph hover, and detail. */
export type EntityPreview = {
  id: string;
  type: EntityType | string;
  key?: string | null;
  title: string;
  summary?: string | null;
  body?: string | null;
  status: EntityStatus | string;
  path?: string;
  /** Task priority (and similar) for badge extras — not a graph tag. */
  priority?: string | null;
};

export function readEntityPriority(metadata?: JsonRecord | null): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  return typeof metadata.priority === "string" && metadata.priority.trim() ? metadata.priority.trim() : null;
}

export function toEntityPreview(
  entity: {
    id: string;
    type: EntityType | string;
    key?: string | null;
    title: string;
    summary?: string | null;
    body?: string | null;
    status: EntityStatus | string;
    path?: string;
    metadata?: JsonRecord;
    priority?: string | null;
  }
): EntityPreview {
  return {
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    summary: entity.summary,
    body: entity.body,
    status: entity.status,
    path: entity.path,
    priority: entity.priority ?? readEntityPriority(entity.metadata)
  };
}

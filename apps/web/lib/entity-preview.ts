import type { Entity, EntityType, EntityStatus } from "@projectplaner/core";

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
};

export function toEntityPreview(
  entity: Pick<Entity, "id" | "type" | "key" | "title" | "summary" | "body" | "status"> & { path?: string }
): EntityPreview {
  return {
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    summary: entity.summary,
    body: entity.body,
    status: entity.status,
    path: entity.path
  };
}

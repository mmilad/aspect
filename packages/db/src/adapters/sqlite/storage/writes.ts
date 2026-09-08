import type { Entity, EntityRelation } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { compactJson } from "./json";
import { run } from "./sqlite";

export function insertEntity(db: DatabaseSync, entity: Entity): void {
  run(
    db,
    `INSERT OR IGNORE INTO entities
     (id, project_id, type, key, slug, title, summary, body, status, sort_order, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entity.id,
      entity.projectId,
      entity.type,
      entity.key,
      entity.slug,
      entity.title,
      entity.summary,
      entity.body,
      entity.status,
      entity.sortOrder,
      compactJson(entity.metadata)
    ]
  );
}

export function insertGenericRelation(db: DatabaseSync, relation: EntityRelation): void {
  run(
    db,
    `INSERT OR IGNORE INTO entity_relations_v2
     (id, project_id, source_entity_id, target_entity_id, type, label, is_primary, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      relation.id,
      relation.projectId,
      relation.sourceEntityId,
      relation.targetEntityId,
      relation.type,
      relation.label,
      relation.isPrimary ? 1 : 0,
      compactJson(relation.metadata)
    ]
  );
}

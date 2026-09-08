import type { Entity, EntityRelation, EntityRelationType, EntityStatus, EntityType } from "@projectplaner/core";
import { parseJson } from "./json";
import type { EntityRelationV2Row, EntityRow } from "./rows";

export function mapEntityRow(row: EntityRow): Entity {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as EntityType,
    key: row.key,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    status: row.status as EntityStatus,
    sortOrder: row.sort_order,
    metadata: parseJson(row.metadata_json, {})
  };
}

export function mapEntityRelationRow(row: EntityRelationV2Row): EntityRelation {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceEntityId: row.source_entity_id,
    targetEntityId: row.target_entity_id,
    type: row.type as EntityRelationType,
    label: row.label,
    isPrimary: Boolean(row.is_primary),
    metadata: parseJson(row.metadata_json, {})
  };
}

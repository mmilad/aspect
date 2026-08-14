import type { DatabaseSync } from "node:sqlite";
import { validateEntityGraph } from "@projectplaner/core";
import type { EntityRelation } from "@projectplaner/core";
import { mapEntityRelationRow, mapEntityRow, type EntityRelationV2Row, type EntityRow } from "../storage";

export function listProjectEntitiesForValidation(db: DatabaseSync, projectId: string) {
  return (db.prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY sort_order ASC").all(projectId) as EntityRow[]).map(
    mapEntityRow
  );
}

export function listProjectRelationsForValidation(db: DatabaseSync, projectId: string): EntityRelation[] {
  return (db.prepare("SELECT * FROM entity_relations_v2 WHERE project_id = ?").all(projectId) as EntityRelationV2Row[]).map(
    mapEntityRelationRow
  );
}

export function validateStoredProjectGraph(db: DatabaseSync, projectId: string) {
  return validateEntityGraph(
    listProjectEntitiesForValidation(db, projectId),
    listProjectRelationsForValidation(db, projectId)
  );
}

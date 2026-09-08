import type { EntityRelation } from "@projectplaner/core";
import domain from "@projectplaner/core/domain";

const { validateEntityGraph } = domain;
import type { DatabaseSync } from "node:sqlite";
import {
  mapEntityRelationRow,
  mapEntityRow,
  type EntityRelationV2Row,
  type EntityRow,
  type ProjectRow
} from "../storage/index";

export function getProjectByKey(db: DatabaseSync, key = "PLAN"): ProjectRow {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as
    | ProjectRow
    | undefined;
  if (!project) {
    throw new Error("Project not found.");
  }
  return project;
}

export function nextEntityKey(db: DatabaseSync, project: ProjectRow, prefix: string): string {
  const rows = db.prepare("SELECT key FROM entities WHERE project_id = ? AND key IS NOT NULL").all(project.id) as {
    key: string;
  }[];
  const nextNumber =
    rows.reduce((max, row) => {
      const match = row.key.match(new RegExp(`^${prefix}-(\\d+)$`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
  return `${prefix}-${nextNumber}`;
}

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
  return validateEntityGraph(listProjectEntitiesForValidation(db, projectId), listProjectRelationsForValidation(db, projectId));
}

export function assertValidProjectGraph(db: DatabaseSync, projectId: string): string[] {
  const result = validateStoredProjectGraph(db, projectId);
  if (result.errors.length > 0) {
    throw new Error(result.errors.join(" "));
  }
  return result.warnings;
}

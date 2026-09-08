import type { EntityRelation, EntityRelationType, JsonRecord } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { compactJson, insertGenericRelation, mapEntityRelationRow, run, type EntityRelationV2Row } from "../storage/index";
import entities from "./entities";
import { assertValidProjectGraph, getProjectByKey } from "./graph";

import type { CreateRelationInput } from "../../../contracts/relations";
export type { CreateRelationInput } from "../../../contracts/relations";

import type { UpdateRelationInput } from "../../../contracts/relations";
export type { UpdateRelationInput } from "../../../contracts/relations";

import type { RelationQuery } from "../../../contracts/relations";
export type { RelationQuery } from "../../../contracts/relations";

async function create(db: DatabaseSync, input: CreateRelationInput): Promise<EntityRelation> {
  const source = await entities.get(db, input.sourceEntityId);
  const target = await entities.get(db, input.targetEntityId);
  if (!source || !target || source.projectId !== target.projectId) {
    throw new Error("Relation endpoints must exist in the same project.");
  }
  if (input.projectKey) {
    getProjectByKey(db, input.projectKey);
  }

  const relation: EntityRelation = {
    id: `ger_${randomUUID()}`,
    projectId: source.projectId,
    sourceEntityId: source.id,
    targetEntityId: target.id,
    type: input.type,
    label: input.label ?? null,
    isPrimary: input.isPrimary ?? false,
    metadata: input.metadata ?? {}
  };

  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    insertGenericRelation(db, relation);
    assertValidProjectGraph(db, relation.projectId);
    if (ownsTransaction) db.exec("COMMIT");
    return relation;
  } catch (error) {
    if (ownsTransaction && db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

async function update(db: DatabaseSync, input: UpdateRelationInput): Promise<EntityRelation> {
  const current = db.prepare("SELECT * FROM entity_relations_v2 WHERE id = ?").get(input.id) as EntityRelationV2Row | undefined;
  if (!current) {
    throw new Error("Relation not found.");
  }
  const next: EntityRelation = { ...mapEntityRelationRow(current), ...input.patch };
  run(
    db,
    `UPDATE entity_relations_v2
     SET type = ?, label = ?, is_primary = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [next.type, next.label, next.isPrimary ? 1 : 0, compactJson(next.metadata), next.id]
  );
  assertValidProjectGraph(db, next.projectId);
  return next;
}

async function remove(db: DatabaseSync, id: string): Promise<void> {
  const current = db.prepare("SELECT * FROM entity_relations_v2 WHERE id = ?").get(id) as EntityRelationV2Row | undefined;
  if (!current) {
    throw new Error("Relation not found.");
  }
  const ownsTransaction = !db.isTransaction;
  if (ownsTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    run(db, "DELETE FROM entity_relations_v2 WHERE id = ?", [id]);
    assertValidProjectGraph(db, current.project_id);
    if (ownsTransaction) db.exec("COMMIT");
  } catch (error) {
    if (ownsTransaction && db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

async function list(db: DatabaseSync, query: RelationQuery = {}): Promise<EntityRelation[]> {
  const values: string[] = [];
  let sql =
    "SELECT entity_relations_v2.* FROM entity_relations_v2 INNER JOIN projects ON projects.id = entity_relations_v2.project_id WHERE 1 = 1";
  if (query.projectKey) {
    sql += " AND projects.key = ?";
    values.push(query.projectKey);
  }
  if (query.sourceEntityId) {
    sql += " AND entity_relations_v2.source_entity_id = ?";
    values.push(query.sourceEntityId);
  }
  if (query.targetEntityId) {
    sql += " AND entity_relations_v2.target_entity_id = ?";
    values.push(query.targetEntityId);
  }
  if (query.type) {
    sql += " AND entity_relations_v2.type = ?";
    values.push(query.type);
  }
  return (db.prepare(sql).all(...values) as EntityRelationV2Row[]).map(mapEntityRelationRow);
}

const relations = {
  create,
  get: async (db: DatabaseSync, id: string): Promise<EntityRelation | null> => {
    const row = db.prepare("SELECT * FROM entity_relations_v2 WHERE id = ?").get(id) as EntityRelationV2Row | undefined;
    return row ? mapEntityRelationRow(row) : null;
  },
  list,
  update,
  remove
};

export default relations;

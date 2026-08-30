import type { Entity, EntityRelationType, EntityStatus, EntityType, JsonRecord } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { compactJson, insertEntity, insertGenericRelation, mapEntityRow, run, slugify, type EntityRow } from "../storage";
import { assertValidProjectGraph, getProjectByKey, nextEntityKey } from "./graph";

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

function assertTaskHasPlanningAnchor(db: DatabaseSync, projectId: string, relations: CreateEntityInput["relations"]): void {
  const relationTargets = relations ?? [];
  if (relationTargets.length === 0) {
    throw new Error(
      "Task entities must link to at least one Aspect or Feature. Create or select an Aspect/Feature first, then pass it as the task target."
    );
  }

  const hasPlanningAnchor = relationTargets.some((relation) => {
    const target = db.prepare("SELECT type FROM entities WHERE id = ? AND project_id = ?").get(relation.targetEntityId, projectId) as
      | { type: string }
      | undefined;
    return target?.type === "aspect" || target?.type === "feature";
  });

  if (!hasPlanningAnchor) {
    throw new Error(
      "Task entities must link to at least one Aspect or Feature. Create or select an Aspect/Feature first, then pass it as the task target."
    );
  }
}

async function create(db: DatabaseSync, input: CreateEntityInput): Promise<{ entity: Entity; warnings: string[] }> {
  const project = getProjectByKey(db, input.projectKey);
  const title = input.title.trim();
  if (!title) {
    throw new Error("Entity title is required.");
  }
  if (input.type === "task") {
    assertTaskHasPlanningAnchor(db, project.id, input.relations);
  }

  const id = `${input.type}_${randomUUID()}`;
  const key =
    input.key === undefined && input.type === "task"
      ? nextEntityKey(db, project, project.key)
      : input.key === undefined && input.type === "feature"
        ? nextEntityKey(db, project, "FEAT")
        : input.key ?? null;
  const entity: Entity = {
    id,
    projectId: project.id,
    type: input.type,
    key,
    slug: input.slug ? slugify(input.slug) : slugify(key ?? title),
    title,
    summary: input.summary?.trim() ?? "",
    body: input.body?.trim() ?? "",
    status: input.status ?? (input.type === "task" ? "planned" : input.type === "decision" || input.type === "question" ? "open" : "planned"),
    sortOrder:
      input.sortOrder ??
      ((db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM entities WHERE project_id = ?").get(project.id) as {
        max_sort: number;
      }).max_sort + 1),
    metadata: input.metadata ?? {}
  };

  db.exec("BEGIN");
  try {
    insertEntity(db, entity);
    for (const relation of input.relations ?? []) {
      const target = db.prepare("SELECT id FROM entities WHERE id = ? AND project_id = ?").get(relation.targetEntityId, project.id);
      if (!target) {
        throw new Error(`Relation target ${relation.targetEntityId} does not exist.`);
      }
      insertGenericRelation(db, {
        id: `ger_${randomUUID()}`,
        projectId: project.id,
        sourceEntityId: entity.id,
        targetEntityId: relation.targetEntityId,
        type: relation.type,
        label: relation.label ?? null,
        isPrimary: relation.isPrimary ?? false,
        metadata: relation.metadata ?? {}
      });
    }
    const warnings = assertValidProjectGraph(db, project.id);
    db.exec("COMMIT");
    if (!input.skipRollup && (entity.type === "aspect" || entity.type === "feature" || entity.type === "task")) {
      const { rollupParentStatus } = await import("../rollup");
      await rollupParentStatus(db, entity.id, { projectKey: input.projectKey });
    }
    return { entity, warnings };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function update(db: DatabaseSync, input: UpdateEntityInput): Promise<Entity> {
  const current = await get(db, input.id);
  if (!current) {
    throw new Error("Entity not found.");
  }

  const statusChanged = input.patch.status !== undefined && input.patch.status !== current.status;

  const next: Entity = {
    ...current,
    ...input.patch,
    key: input.patch.key === undefined ? current.key : input.patch.key,
    metadata: input.patch.metadata === undefined ? current.metadata : input.patch.metadata
  };

  run(
    db,
    `UPDATE entities
     SET key = ?, slug = ?, title = ?, summary = ?, body = ?, status = ?, sort_order = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      next.key,
      next.slug,
      next.title,
      next.summary,
      next.body,
      next.status,
      next.sortOrder,
      compactJson(next.metadata),
      next.id
    ]
  );
  assertValidProjectGraph(db, next.projectId);

  if (
    !input.skipRollup &&
    statusChanged &&
    (next.type === "aspect" || next.type === "feature" || next.type === "task")
  ) {
    const { rollupParentStatus } = await import("../rollup");
    await rollupParentStatus(db, next.id);
  }

  return next;
}

async function remove(db: DatabaseSync, id: string): Promise<void> {
  const entity = await get(db, id);
  if (!entity) {
    throw new Error("Entity not found.");
  }

  db.exec("BEGIN");
  try {
    run(db, "DELETE FROM entities WHERE id = ?", [id]);
    assertValidProjectGraph(db, entity.projectId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function get(db: DatabaseSync, id: string): Promise<Entity | null> {
  const row = db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as EntityRow | undefined;
  return row ? mapEntityRow(row) : null;
}

async function list(db: DatabaseSync, query: EntityQuery = {}): Promise<Entity[]> {
  const values: string[] = [];
  let sql = "SELECT entities.* FROM entities INNER JOIN projects ON projects.id = entities.project_id WHERE 1 = 1";
  if (query.projectKey) {
    sql += " AND projects.key = ?";
    values.push(query.projectKey);
  }
  if (query.type) {
    sql += " AND entities.type = ?";
    values.push(query.type);
  }
  if (query.includeArchived !== true) {
    sql += " AND entities.status != ?";
    values.push("archived");
  }
  if (query.query) {
    sql += " AND (entities.title LIKE ? OR entities.slug LIKE ? OR entities.summary LIKE ? OR entities.body LIKE ?)";
    const pattern = `%${query.query}%`;
    values.push(pattern, pattern, pattern, pattern);
  }
  sql += " ORDER BY entities.sort_order ASC";
  return (db.prepare(sql).all(...values) as EntityRow[]).map(mapEntityRow);
}

const entities = {
  create,
  get,
  list,
  update,
  remove
};

export default entities;

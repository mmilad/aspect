import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { insertEntity, run, slugify, type ProjectRow } from "../storage";
import { assertValidProjectGraph } from "./graph";

export const PROTECTED_PROJECT_KEY = "PLAN";

export type ProjectSummary = {
  id: string;
  key: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  entityCount: number;
  workflowCount: number;
};

export type ProjectStatsBucket = {
  total: number;
  planning: number;
  inProgress: number;
  done: number;
  other: number;
};

export type ProjectStats = {
  project: { id: string; key: string; title: string; description: string };
  byType: Record<string, ProjectStatsBucket>;
  workflowDefs: number;
};

export type CreateProjectInput = {
  key: string;
  title: string;
  description?: string;
};

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/;

function emptyStatsBucket(): ProjectStatsBucket {
  return { total: 0, planning: 0, inProgress: 0, done: 0, other: 0 };
}

function statusBucket(status: string): keyof Omit<ProjectStatsBucket, "total"> {
  if (status === "in_planning" || status === "planned" || status === "open") {
    return "planning";
  }
  if (status === "in_progress") {
    return "inProgress";
  }
  if (status === "done" || status === "accepted" || status === "answered") {
    return "done";
  }
  return "other";
}

function normalizeProjectKey(raw: string): string {
  const key = raw.trim().toUpperCase();
  if (!PROJECT_KEY_PATTERN.test(key)) {
    throw new Error("Project key must be 1–32 chars: start with A–Z, then A–Z / 0–9 / _.");
  }
  return key;
}

async function list(db: DatabaseSync): Promise<ProjectSummary[]> {
  const rows = db
    .prepare(
      `SELECT
         p.id,
         p.key,
         p.title,
         p.description,
         p.created_at AS createdAt,
         p.updated_at AS updatedAt,
         (
           SELECT COUNT(*) FROM entities e
           WHERE e.project_id = p.id AND e.status != 'archived'
         ) AS entityCount,
         (
           SELECT COUNT(*) FROM workflow_defs w
           WHERE w.project_id = p.id
         ) AS workflowCount
       FROM projects p
       ORDER BY p.key ASC`
    )
    .all() as Array<{
    id: string;
    key: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    entityCount: number;
    workflowCount: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entityCount: Number(row.entityCount) || 0,
    workflowCount: Number(row.workflowCount) || 0
  }));
}

async function create(db: DatabaseSync, input: CreateProjectInput): Promise<{ project: ProjectSummary }> {
  const key = normalizeProjectKey(input.key);
  const title = input.title.trim();
  if (!title) {
    throw new Error("Project title is required.");
  }
  const description = input.description?.trim() ?? "";

  const existing = db.prepare("SELECT id FROM projects WHERE key = ?").get(key);
  if (existing) {
    throw new Error(`Project key ${key} already exists.`);
  }

  const id = `project_${randomUUID()}`;
  const rootEntityId = `project_${randomUUID()}`;

  db.exec("BEGIN");
  try {
    run(db, "INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)", [id, key, title, description]);
    insertEntity(db, {
      id: rootEntityId,
      projectId: id,
      type: "project",
      key,
      slug: slugify(key),
      title,
      summary: description,
      body: description,
      status: "in_progress",
      sortOrder: 0,
      metadata: {}
    });
    assertValidProjectGraph(db, id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const created = (await list(db)).find((project) => project.key === key);
  if (!created) {
    throw new Error("Project created but could not be reloaded.");
  }
  return { project: created };
}

async function remove(db: DatabaseSync, key: string): Promise<{ deleted: string }> {
  const normalized = key.trim().toUpperCase();
  if (normalized === PROTECTED_PROJECT_KEY) {
    throw new Error(`Cannot delete protected project ${PROTECTED_PROJECT_KEY}.`);
  }

  const project = db.prepare("SELECT id, key FROM projects WHERE key = ?").get(normalized) as
    | { id: string; key: string }
    | undefined;
  if (!project) {
    throw new Error("Project not found.");
  }

  run(db, "DELETE FROM projects WHERE id = ?", [project.id]);
  return { deleted: project.key };
}

async function stats(db: DatabaseSync, key: string): Promise<ProjectStats | null> {
  const project = db.prepare("SELECT id, key, title, description FROM projects WHERE key = ?").get(key) as
    | ProjectRow
    | undefined;
  if (!project) {
    return null;
  }

  const typeRows = db
    .prepare(
      `SELECT type, status, COUNT(*) AS count
       FROM entities
       WHERE project_id = ? AND status != 'archived'
       GROUP BY type, status`
    )
    .all(project.id) as Array<{ type: string; status: string; count: number }>;

  const byType: Record<string, ProjectStatsBucket> = {};
  for (const row of typeRows) {
    const bucket = byType[row.type] ?? emptyStatsBucket();
    const n = Number(row.count) || 0;
    bucket.total += n;
    bucket[statusBucket(row.status)] += n;
    byType[row.type] = bucket;
  }

  const workflowDefs =
    (
      db.prepare("SELECT COUNT(*) AS count FROM workflow_defs WHERE project_id = ?").get(project.id) as
        | { count: number }
        | undefined
    )?.count ?? 0;

  return {
    project: {
      id: project.id,
      key: project.key,
      title: project.title,
      description: project.description
    },
    byType,
    workflowDefs: Number(workflowDefs) || 0
  };
}

const projects = {
  list,
  create,
  remove,
  stats,
  PROTECTED_PROJECT_KEY
};

export default projects;

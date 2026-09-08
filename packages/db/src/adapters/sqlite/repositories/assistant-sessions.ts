import assistant from "@projectplaner/core/assistant";
import type { AssistantSession, AssistantSessionRecord, AssistantSessionStatus } from "@projectplaner/core/assistant";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { compactUnknownJson, parseJson } from "../storage/index";

const { emptySession, parseSession, normalize, titleFromSession } = assistant;

import type { AssistantSessionRow } from "../../../contracts/assistant-sessions";
export type { AssistantSessionRow } from "../../../contracts/assistant-sessions";

type SqlRow = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  session_json: string;
  context_entity_id: string | null;
  created_at: string;
  updated_at: string;
};

function findProjectId(db: DatabaseSync, projectKey: string): string | null {
  const row = db.prepare("SELECT id FROM projects WHERE key = ?").get(projectKey) as { id: string } | undefined;
  return row?.id ?? null;
}

function requireProjectId(db: DatabaseSync, projectKey: string): string {
  const projectId = findProjectId(db, projectKey);
  if (!projectId) {
    throw new Error(`Unknown project key: ${projectKey}`);
  }
  return projectId;
}

function parseStatus(value: string): AssistantSessionStatus {
  return value === "archived" ? "archived" : "active";
}

function mapRow(row: SqlRow, fallbackProjectKey: string): AssistantSessionRecord {
  const session = normalize(parseSession(parseJson(row.session_json, {}), fallbackProjectKey));
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: parseStatus(row.status),
    session,
    contextEntityId: row.context_entity_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function get(db: DatabaseSync, id: string): AssistantSessionRecord | null {
  const row = db.prepare(`SELECT * FROM assistant_sessions WHERE id = ?`).get(id) as SqlRow | undefined;
  if (!row) {
    return null;
  }
  const project = db.prepare(`SELECT key FROM projects WHERE id = ?`).get(row.project_id) as
    | { key: string }
    | undefined;
  return mapRow(row, project?.key ?? "");
}

function list(
  db: DatabaseSync,
  projectKey: string,
  options?: { includeArchived?: boolean }
): AssistantSessionRecord[] {
  const projectId = findProjectId(db, projectKey);
  if (!projectId) {
    return [];
  }
  const rows = (
    options?.includeArchived
      ? db
          .prepare(`SELECT * FROM assistant_sessions WHERE project_id = ? ORDER BY updated_at DESC`)
          .all(projectId)
      : db
          .prepare(
            `SELECT * FROM assistant_sessions WHERE project_id = ? AND status = 'active' ORDER BY updated_at DESC`
          )
          .all(projectId)
  ) as SqlRow[];
  return rows.map((row) => mapRow(row, projectKey));
}

function insertEmpty(db: DatabaseSync, projectId: string, projectKey: string): AssistantSessionRecord {
  const id = `asst_${randomUUID()}`;
  const session = emptySession(projectKey);
  db.prepare(
    `INSERT INTO assistant_sessions (id, project_id, title, status, session_json, context_entity_id)
     VALUES (?, ?, ?, 'active', ?, NULL)`
  ).run(id, projectId, titleFromSession(session), compactUnknownJson(session));
  const created = get(db, id);
  if (!created) {
    throw new Error("Failed to create assistant session.");
  }
  return created;
}

function getOrCreateActive(db: DatabaseSync, projectKey: string): AssistantSessionRecord {
  const projectId = requireProjectId(db, projectKey);
  const row = db
    .prepare(
      `SELECT * FROM assistant_sessions
       WHERE project_id = ? AND status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .get(projectId) as SqlRow | undefined;
  if (row) {
    return mapRow(row, projectKey);
  }
  return insertEmpty(db, projectId, projectKey);
}

function create(db: DatabaseSync, projectKey: string): AssistantSessionRecord {
  return insertEmpty(db, requireProjectId(db, projectKey), projectKey);
}

function save(
  db: DatabaseSync,
  id: string,
  session: AssistantSession
): AssistantSessionRecord {
  const existing = get(db, id);
  if (!existing) {
    throw new Error(`Unknown assistant session: ${id}`);
  }
  const next = normalize(session);
  const title = titleFromSession(next);
  const contextEntityId = next.context.entityId ?? null;
  db.prepare(
    `UPDATE assistant_sessions
     SET title = ?, session_json = ?, context_entity_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(title, compactUnknownJson(next), contextEntityId, id);
  const saved = get(db, id);
  if (!saved) {
    throw new Error(`Failed to save assistant session: ${id}`);
  }
  return saved;
}

function archive(db: DatabaseSync, id: string): AssistantSessionRecord {
  const existing = get(db, id);
  if (!existing) {
    throw new Error(`Unknown assistant session: ${id}`);
  }
  db.prepare(
    `UPDATE assistant_sessions SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(id);
  const saved = get(db, id);
  if (!saved) {
    throw new Error(`Failed to archive assistant session: ${id}`);
  }
  return saved;
}

const assistantSessions = {
  get,
  list,
  getOrCreateActive,
  create,
  save,
  archive
};

export default assistantSessions;
export type { AssistantSession, AssistantSessionRecord, AssistantSessionStatus };

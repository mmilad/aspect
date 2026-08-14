import { LLM_JSON_SCHEMA_PRESETS } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export type LlmJsonSchemaRecord = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
  status: string;
  version: number;
};

export type EnsureLlmJsonSchemasOptions = {
  projectKey?: string;
  force?: boolean;
  only?: string[];
};

export type EnsureLlmJsonSchemasResult = {
  seeded: string[];
  skipped: string[];
  reseeded: string[];
};

export type CreateLlmJsonSchemaInput = {
  projectKey?: string;
  key: string;
  title: string;
  description?: string;
  schema: Record<string, unknown>;
};

type SchemaRow = {
  id: string;
  project_id: string;
  key: string;
  title: string;
  description: string;
  schema_json: string;
  status: string;
};

function parseSchemaJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function findProjectId(db: DatabaseSync, projectKey: string): string | null {
  const row = db.prepare("SELECT id FROM projects WHERE key = ?").get(projectKey) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

function currentVersion(db: DatabaseSync, schemaId: string): number {
  const row = db
    .prepare(`SELECT MAX(version) AS version FROM llm_json_schema_versions WHERE schema_id = ?`)
    .get(schemaId) as { version: number | null } | undefined;
  return row?.version ?? 0;
}

function insertVersion(db: DatabaseSync, schemaId: string, version: number, schemaJson: string): void {
  db.prepare(
    `INSERT INTO llm_json_schema_versions (id, schema_id, version, schema_json) VALUES (?, ?, ?, ?)`
  ).run(`ljsv_${randomUUID()}`, schemaId, version, schemaJson);
}

export function getLlmJsonSchemaByKey(
  db: DatabaseSync,
  key: string,
  projectKey = "PLAN"
): LlmJsonSchemaRecord | null {
  const row = db
    .prepare(
      `SELECT s.id, s.project_id, s.key, s.title, s.description, s.schema_json, s.status
       FROM llm_json_schemas s
       INNER JOIN projects p ON p.id = s.project_id
       WHERE p.key = ? AND s.key = ?
       LIMIT 1`
    )
    .get(projectKey, key) as SchemaRow | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    title: row.title,
    description: row.description,
    schema: parseSchemaJson(row.schema_json),
    status: row.status,
    version: currentVersion(db, row.id)
  };
}

export function listLlmJsonSchemas(
  db: DatabaseSync,
  projectKey = "PLAN"
): LlmJsonSchemaRecord[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.project_id, s.key, s.title, s.description, s.schema_json, s.status
       FROM llm_json_schemas s
       INNER JOIN projects p ON p.id = s.project_id
       WHERE p.key = ?
       ORDER BY s.key`
    )
    .all(projectKey) as SchemaRow[];
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    title: row.title,
    description: row.description,
    schema: parseSchemaJson(row.schema_json),
    status: row.status,
    version: currentVersion(db, row.id)
  }));
}

export function createLlmJsonSchema(
  db: DatabaseSync,
  input: CreateLlmJsonSchemaInput
): LlmJsonSchemaRecord {
  const projectKey = input.projectKey ?? "PLAN";
  const projectId = findProjectId(db, projectKey);
  if (!projectId) {
    throw new Error(`Project "${projectKey}" was not found.`);
  }

  const key = input.key.trim();
  const title = input.title.trim();
  if (!key) {
    throw new Error("Schema key is required.");
  }
  if (!title) {
    throw new Error("Schema title is required.");
  }

  const existing = getLlmJsonSchemaByKey(db, key, projectKey);
  if (existing) {
    throw new Error(`Schema key "${key}" already exists.`);
  }

  const id = `ljs_${randomUUID()}`;
  const schemaJson = JSON.stringify(input.schema);
  db.prepare(
    `INSERT INTO llm_json_schemas (id, project_id, key, title, description, schema_json, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).run(id, projectId, key, title, input.description?.trim() ?? "", schemaJson);
  insertVersion(db, id, 1, schemaJson);

  const created = getLlmJsonSchemaByKey(db, key, projectKey);
  if (!created) {
    throw new Error("Schema was not created.");
  }
  return created;
}

/**
 * Seed catalog JSON Schema presets once. force=true replaces schema_json and bumps version when changed.
 */
export function ensureLlmJsonSchemas(
  db: DatabaseSync,
  options: EnsureLlmJsonSchemasOptions = {}
): EnsureLlmJsonSchemasResult {
  const projectKey = options.projectKey ?? "PLAN";
  const force = Boolean(options.force) || process.env.PROJECTPLANER_PRESETS_FORCE === "1";
  const only = options.only?.length ? new Set(options.only) : null;
  const seeded: string[] = [];
  const skipped: string[] = [];
  const reseeded: string[] = [];

  const projectId = findProjectId(db, projectKey);
  if (!projectId) {
    return { seeded, skipped, reseeded };
  }

  const presets = LLM_JSON_SCHEMA_PRESETS.filter((preset) => !only || only.has(preset.key));

  for (const preset of presets) {
    const existing = getLlmJsonSchemaByKey(db, preset.key, projectKey);
    const schemaJson = JSON.stringify(preset.schema);

    if (!existing) {
      const id = `ljs_${randomUUID()}`;
      db.prepare(
        `INSERT INTO llm_json_schemas (id, project_id, key, title, description, schema_json, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`
      ).run(id, projectId, preset.key, preset.title, preset.description, schemaJson);
      insertVersion(db, id, 1, schemaJson);
      seeded.push(preset.key);
      continue;
    }

    if (!force) {
      skipped.push(preset.key);
      continue;
    }

    if (JSON.stringify(existing.schema) === schemaJson) {
      skipped.push(preset.key);
      continue;
    }

    const nextVersion = existing.version + 1;
    db.prepare(
      `UPDATE llm_json_schemas
       SET title = ?, description = ?, schema_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(preset.title, preset.description, schemaJson, existing.id);
    insertVersion(db, existing.id, nextVersion, schemaJson);
    reseeded.push(preset.key);
  }

  return { seeded, skipped, reseeded };
}

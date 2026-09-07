import type { DatabaseSync } from "node:sqlite";

export function migrateWorkspaces(db: DatabaseSync): void {
  const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "archived_at")) {
    db.exec("ALTER TABLE projects ADD COLUMN archived_at TEXT;");
  }
  db.exec(`CREATE TABLE IF NOT EXISTS project_workspaces (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
    repository_path TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL CHECK (mode IN ('create', 'import')),
    source_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('provisioning', 'ready', 'failed')),
    attempt_id TEXT NOT NULL,
    owner_pid INTEGER NOT NULL,
    deadline_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    error_json TEXT
  );`);
}

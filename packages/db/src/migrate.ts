export interface MigrationDatabase {
  exec(sql: string): unknown;
}

export function runMigrations(sqlite: MigrationDatabase): void {
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      slug TEXT NOT NULL,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planned',
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS nodes_project_path_idx ON nodes(project_id, path);
    CREATE UNIQUE INDEX IF NOT EXISTS nodes_sibling_slug_idx ON nodes(project_id, parent_id, slug);

    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS draft_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      scope_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
      hypothesis TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS draft_changes (
      id TEXT PRIMARY KEY,
      draft_plan_id TEXT NOT NULL REFERENCES draft_plans(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS node_tasks (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

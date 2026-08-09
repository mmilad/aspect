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

    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_feature_id TEXT,
      key TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planned',
      acceptance_shape TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS feature_aspect_links (
      id TEXT PRIMARY KEY,
      feature_id TEXT NOT NULL,
      aspect_id TEXT NOT NULL,
      type TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_links (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      type TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entity_relations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'custom'
    );

    CREATE TABLE IF NOT EXISTS tag_assignments (
      id TEXT PRIMARY KEY,
      tag_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      key TEXT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planned',
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS entities_project_type_idx ON entities(project_id, type);
    CREATE UNIQUE INDEX IF NOT EXISTS entities_project_slug_idx ON entities(project_id, type, slug);

    CREATE TABLE IF NOT EXISTS entity_relations_v2 (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      target_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS entity_relations_v2_source_idx ON entity_relations_v2(project_id, source_entity_id);
    CREATE INDEX IF NOT EXISTS entity_relations_v2_target_idx ON entity_relations_v2(project_id, target_entity_id);

    CREATE TABLE IF NOT EXISTS entity_tag_assignments (
      id TEXT PRIMARY KEY,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_defs (
      workflow_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      schema_version INTEGER NOT NULL DEFAULT 2,
      published_version_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflow_defs(workflow_id) ON DELETE CASCADE,
      name TEXT,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_nodes (
      id TEXT NOT NULL,
      workflow_id TEXT NOT NULL REFERENCES workflow_defs(workflow_id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (workflow_id, id)
    );

    CREATE TABLE IF NOT EXISTS workflow_edges (
      id TEXT NOT NULL,
      workflow_id TEXT NOT NULL REFERENCES workflow_defs(workflow_id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'next',
      label TEXT,
      config_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (workflow_id, id)
    );

    CREATE INDEX IF NOT EXISTS workflow_nodes_workflow_idx ON workflow_nodes(workflow_id);
    CREATE INDEX IF NOT EXISTS workflow_edges_workflow_idx ON workflow_edges(workflow_id);

    CREATE TABLE IF NOT EXISTS workflow_triggers (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflow_defs(workflow_id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS workflow_triggers_workflow_idx ON workflow_triggers(workflow_id);

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflow_defs(workflow_id) ON DELETE CASCADE,
      trigger_id TEXT REFERENCES workflow_triggers(id) ON DELETE SET NULL,
      version_id TEXT REFERENCES workflow_versions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'running',
      definition_snapshot_json TEXT NOT NULL,
      bag_json TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs(workflow_id);

    CREATE TABLE IF NOT EXISTS workflow_node_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      route_label TEXT,
      error_json TEXT,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS workflow_node_runs_run_idx ON workflow_node_runs(run_id);

    CREATE TABLE IF NOT EXISTS workflow_run_tokens (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      scope_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS workflow_run_tokens_run_idx ON workflow_run_tokens(run_id);
  `);
}

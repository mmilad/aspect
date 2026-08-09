import {
  parseWorkflowGraph,
  WORKFLOW_SCHEMA_VERSION,
  type JsonRecord,
  type WorkflowEdge,
  type WorkflowEdgeKind,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType
} from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function run(db: DatabaseSync, sql: string, values: (string | number | null)[] = []): void {
  db.prepare(sql).run(...values);
}

function compactJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export type WorkflowTriggerKind = "manual" | "api" | "entity_status" | "schedule" | "webhook";

export type WorkflowRunStatus =
  | "running"
  | "pending_llm"
  | "pending_user"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowNodeRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "waiting";

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  kind: WorkflowTriggerKind;
  enabled: boolean;
  config: JsonRecord;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  triggerId: string | null;
  versionId: string | null;
  status: WorkflowRunStatus;
  definitionSnapshot: WorkflowGraph;
  bag: JsonRecord;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface WorkflowNodeRun {
  id: string;
  runId: string;
  nodeId: string;
  attempt: number;
  status: WorkflowNodeRunStatus;
  input: JsonRecord;
  output: JsonRecord;
  routeLabel: string | null;
  error: JsonRecord | null;
  startedAt: string | null;
  finishedAt: string | null;
}

function ensureWorkflowDef(db: DatabaseSync, workflowId: string, projectId: string): void {
  const existing = db
    .prepare(`SELECT workflow_id FROM workflow_defs WHERE workflow_id = ?`)
    .get(workflowId) as { workflow_id: string } | undefined;
  if (existing) {
    return;
  }
  run(
    db,
    `INSERT INTO workflow_defs (workflow_id, project_id, schema_version, metadata_json)
     VALUES (?, ?, ?, '{}')`,
    [workflowId, projectId, WORKFLOW_SCHEMA_VERSION]
  );
  run(
    db,
    `INSERT INTO workflow_triggers (id, workflow_id, kind, enabled, config_json)
     VALUES (?, ?, 'manual', 1, '{}')`,
    [`wtrig_${randomUUID()}`, workflowId]
  );
}

export function loadWorkflowGraph(db: DatabaseSync, workflowId: string): WorkflowGraph | null {
  const nodeRows = db
    .prepare(
      `SELECT id, type, title, pos_x, pos_y, config_json
       FROM workflow_nodes WHERE workflow_id = ? ORDER BY sort_order, id`
    )
    .all(workflowId) as Array<{
    id: string;
    type: string;
    title: string;
    pos_x: number;
    pos_y: number;
    config_json: string;
  }>;

  if (nodeRows.length === 0) {
    return null;
  }

  const edgeRows = db
    .prepare(
      `SELECT id, source_id, target_id, kind, label
       FROM workflow_edges WHERE workflow_id = ? ORDER BY id`
    )
    .all(workflowId) as Array<{
    id: string;
    source_id: string;
    target_id: string;
    kind: string;
    label: string | null;
  }>;

  const nodes: WorkflowNode[] = nodeRows.map((row) => {
    const config = parseJson<JsonRecord>(row.config_json, {});
    const { title: _ignoredTitle, ...rest } = config;
    return {
      id: row.id,
      type: row.type as WorkflowNodeType,
      position: { x: row.pos_x, y: row.pos_y },
      data: {
        ...rest,
        title: row.title || (typeof config.title === "string" ? config.title : row.type)
      }
    };
  });

  const edges: WorkflowEdge[] = edgeRows.map((row) => ({
    id: row.id,
    source: row.source_id,
    target: row.target_id,
    kind: row.kind as WorkflowEdgeKind,
    label: row.label ?? undefined
  }));

  const parsed = parseWorkflowGraph({ version: WORKFLOW_SCHEMA_VERSION, nodes, edges });
  return parsed.ok ? parsed.graph : { version: WORKFLOW_SCHEMA_VERSION, nodes, edges };
}

export function saveWorkflowGraph(
  db: DatabaseSync,
  input: {
    workflowId: string;
    projectId: string;
    graph: WorkflowGraph;
  }
): WorkflowGraph {
  const parsed = parseWorkflowGraph(input.graph);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("; "));
  }
  const graph = parsed.graph;

  db.exec("BEGIN");
  try {
    ensureWorkflowDef(db, input.workflowId, input.projectId);
    run(db, `DELETE FROM workflow_edges WHERE workflow_id = ?`, [input.workflowId]);
    run(db, `DELETE FROM workflow_nodes WHERE workflow_id = ?`, [input.workflowId]);

    graph.nodes.forEach((node, index) => {
      const { title, ...rest } = node.data;
      run(
        db,
        `INSERT INTO workflow_nodes
          (id, workflow_id, type, title, pos_x, pos_y, config_json, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          node.id,
          input.workflowId,
          node.type,
          title,
          node.position.x,
          node.position.y,
          compactJson(rest),
          index
        ]
      );
    });

    for (const edge of graph.edges) {
      run(
        db,
        `INSERT INTO workflow_edges
          (id, workflow_id, source_id, target_id, kind, label, config_json)
         VALUES (?, ?, ?, ?, ?, ?, '{}')`,
        [edge.id, input.workflowId, edge.source, edge.target, edge.kind, edge.label ?? null]
      );
    }

    run(
      db,
      `UPDATE workflow_defs
       SET schema_version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE workflow_id = ?`,
      [WORKFLOW_SCHEMA_VERSION, input.workflowId]
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return graph;
}

/** Prefer dedicated tables; fall back to flow.metadata.graph and migrate. */
export function getOrMigrateWorkflowGraph(
  db: DatabaseSync,
  input: {
    workflowId: string;
    projectId: string;
    metadata: JsonRecord;
  }
): WorkflowGraph | null {
  const existing = loadWorkflowGraph(db, input.workflowId);
  if (existing) {
    return existing;
  }

  const parsed = parseWorkflowGraph(input.metadata.graph);
  if (!parsed.ok) {
    return null;
  }

  return saveWorkflowGraph(db, {
    workflowId: input.workflowId,
    projectId: input.projectId,
    graph: parsed.graph
  });
}

export function listWorkflowTriggers(db: DatabaseSync, workflowId: string): WorkflowTrigger[] {
  const rows = db
    .prepare(
      `SELECT id, workflow_id, kind, enabled, config_json
       FROM workflow_triggers WHERE workflow_id = ? ORDER BY kind, id`
    )
    .all(workflowId) as Array<{
    id: string;
    workflow_id: string;
    kind: string;
    enabled: number;
    config_json: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    kind: row.kind as WorkflowTriggerKind,
    enabled: row.enabled === 1,
    config: parseJson(row.config_json, {})
  }));
}

export function createWorkflowRun(
  db: DatabaseSync,
  input: {
    workflowId: string;
    projectId: string;
    graph: WorkflowGraph;
    bag?: JsonRecord;
    triggerId?: string | null;
  }
): WorkflowRun {
  ensureWorkflowDef(db, input.workflowId, input.projectId);
  const id = `wrun_${randomUUID()}`;
  const snapshot = JSON.stringify(input.graph);
  const bag = input.bag ?? {};
  run(
    db,
    `INSERT INTO workflow_runs
      (id, workflow_id, trigger_id, version_id, status, definition_snapshot_json, bag_json)
     VALUES (?, ?, ?, NULL, 'running', ?, ?)`,
    [id, input.workflowId, input.triggerId ?? null, snapshot, compactJson(bag)]
  );

  return {
    id,
    workflowId: input.workflowId,
    triggerId: input.triggerId ?? null,
    versionId: null,
    status: "running",
    definitionSnapshot: input.graph,
    bag,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
}

export function updateWorkflowRun(
  db: DatabaseSync,
  input: {
    id: string;
    status?: WorkflowRunStatus;
    bag?: JsonRecord;
    error?: string | null;
    finished?: boolean;
  }
): void {
  const current = db
    .prepare(`SELECT status, bag_json FROM workflow_runs WHERE id = ?`)
    .get(input.id) as { status: string; bag_json: string } | undefined;
  if (!current) {
    throw new Error(`Workflow run ${input.id} not found.`);
  }

  run(
    db,
    `UPDATE workflow_runs
     SET status = ?, bag_json = ?, error = ?, finished_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE finished_at END
     WHERE id = ?`,
    [
      input.status ?? current.status,
      compactJson(input.bag ?? parseJson(current.bag_json, {})),
      input.error === undefined ? null : input.error,
      input.finished ? 1 : 0,
      input.id
    ]
  );
}

export function recordWorkflowNodeRun(
  db: DatabaseSync,
  input: {
    runId: string;
    nodeId: string;
    attempt?: number;
    status: WorkflowNodeRunStatus;
    input?: JsonRecord;
    output?: JsonRecord;
    routeLabel?: string | null;
    error?: JsonRecord | null;
  }
): WorkflowNodeRun {
  const id = `wnrun_${randomUUID()}`;
  const started = input.status === "running" || input.status === "succeeded" || input.status === "failed";
  run(
    db,
    `INSERT INTO workflow_node_runs
      (id, run_id, node_id, attempt, status, input_json, output_json, route_label, error_json, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
             CASE WHEN ? IN ('succeeded','failed','cancelled') THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    [
      id,
      input.runId,
      input.nodeId,
      input.attempt ?? 1,
      input.status,
      compactJson(input.input ?? {}),
      compactJson(input.output ?? {}),
      input.routeLabel ?? null,
      input.error ? compactJson(input.error) : null,
      started ? 1 : 0,
      input.status
    ]
  );

  return {
    id,
    runId: input.runId,
    nodeId: input.nodeId,
    attempt: input.attempt ?? 1,
    status: input.status,
    input: input.input ?? {},
    output: input.output ?? {},
    routeLabel: input.routeLabel ?? null,
    error: input.error ?? null,
    startedAt: started ? new Date().toISOString() : null,
    finishedAt:
      input.status === "succeeded" || input.status === "failed" || input.status === "cancelled"
        ? new Date().toISOString()
        : null
  };
}

export function listWorkflowNodeRuns(db: DatabaseSync, runId: string): WorkflowNodeRun[] {
  const rows = db
    .prepare(
      `SELECT id, run_id, node_id, attempt, status, input_json, output_json, route_label, error_json, started_at, finished_at
       FROM workflow_node_runs WHERE run_id = ? ORDER BY started_at, id`
    )
    .all(runId) as Array<{
    id: string;
    run_id: string;
    node_id: string;
    attempt: number;
    status: string;
    input_json: string;
    output_json: string;
    route_label: string | null;
    error_json: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    nodeId: row.node_id,
    attempt: row.attempt,
    status: row.status as WorkflowNodeRunStatus,
    input: parseJson(row.input_json, {}),
    output: parseJson(row.output_json, {}),
    routeLabel: row.route_label,
    error: row.error_json ? parseJson(row.error_json, {}) : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }));
}

export function getWorkflowRun(db: DatabaseSync, runId: string): WorkflowRun | null {
  const row = db
    .prepare(
      `SELECT id, workflow_id, trigger_id, version_id, status, definition_snapshot_json, bag_json, error, started_at, finished_at
       FROM workflow_runs WHERE id = ?`
    )
    .get(runId) as
    | {
        id: string;
        workflow_id: string;
        trigger_id: string | null;
        version_id: string | null;
        status: string;
        definition_snapshot_json: string;
        bag_json: string;
        error: string | null;
        started_at: string;
        finished_at: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  const snapshot = parseJson<WorkflowGraph>(row.definition_snapshot_json, {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [],
    edges: []
  });

  return {
    id: row.id,
    workflowId: row.workflow_id,
    triggerId: row.trigger_id,
    versionId: row.version_id,
    status: row.status as WorkflowRunStatus,
    definitionSnapshot: snapshot,
    bag: parseJson(row.bag_json, {}),
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { createDatabase } from "../sqlite/client";
import { loadWorkflowGraph, listWorkflowTriggers } from "../sqlite/workflows/persist";
import { ensurePostgresSchema } from "./index";

type SqlRow = Record<string, any>;
type MigrationCounts = Record<string, number>;

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "string") return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function jsonbValue(value: unknown, fallback: unknown): string | null {
  const parsed = parseJson(value, fallback);
  return parsed === undefined || parsed === null ? null : JSON.stringify(parsed);
}

async function insert(client: { query(text: string, values?: unknown[]): Promise<unknown> }, sql: string, values: unknown[]): Promise<void> {
  await client.query(sql, values);
}

function rows(db: DatabaseSync, sql: string, ...values: unknown[]): SqlRow[] {
  return db.prepare(sql).all(...values as Array<string | number | null>) as SqlRow[];
}

/**
 * Copy the durable Projectplaner records from SQLite into the Postgres adapter.
 * IDs and timestamps are supplied explicitly, so this operation is repeatable.
 * The SQLite database is never modified.
 */
export async function migrateSqliteToPostgres(input: {
  sourcePath: string;
  databaseUrl: string;
}): Promise<MigrationCounts> {
  const source = createDatabase(input.sourcePath);
  const pool = new Pool({ connectionString: input.databaseUrl, max: 4 });
  const client = await pool.connect();
  const counts: MigrationCounts = {};
  const count = (key: string, value: number) => { counts[key] = value; };
  try {
    await ensurePostgresSchema(client);
    await client.query("BEGIN");

    const projects = rows(source, "SELECT id,key,title,description,archived_at,created_at,updated_at FROM projects");
    for (const row of projects) await insert(client,
      `INSERT INTO pp_projects (id,key,title,description,archived_at,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET key=EXCLUDED.key,title=EXCLUDED.title,description=EXCLUDED.description,
         archived_at=EXCLUDED.archived_at,updated_at=EXCLUDED.updated_at`,
      [row.id, row.key, row.title, row.description, row.archived_at, row.created_at, row.updated_at]);
    count("projects", projects.length);

    const entities = rows(source, "SELECT id,project_id,type,key,slug,title,summary,body,status,sort_order,metadata_json,created_at,updated_at FROM entities");
    for (const row of entities) await insert(client,
      `INSERT INTO pp_entities (id,project_id,type,key,slug,title,summary,body,status,sort_order,metadata,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,type=EXCLUDED.type,key=EXCLUDED.key,slug=EXCLUDED.slug,
         title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,status=EXCLUDED.status,sort_order=EXCLUDED.sort_order,
         metadata=EXCLUDED.metadata,updated_at=EXCLUDED.updated_at`,
      [row.id, row.project_id, row.type, row.key, row.slug, row.title, row.summary, row.body, row.status, row.sort_order,
        jsonbValue(row.metadata_json, {}), row.created_at, row.updated_at]);
    count("entities", entities.length);

    const relations = rows(source, "SELECT id,project_id,source_entity_id,target_entity_id,type,label,is_primary,metadata_json,created_at,updated_at FROM entity_relations_v2");
    for (const row of relations) await insert(client,
      `INSERT INTO pp_relations (id,project_id,source_entity_id,target_entity_id,type,label,is_primary,metadata,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,source_entity_id=EXCLUDED.source_entity_id,
         target_entity_id=EXCLUDED.target_entity_id,type=EXCLUDED.type,label=EXCLUDED.label,is_primary=EXCLUDED.is_primary,
         metadata=EXCLUDED.metadata,updated_at=EXCLUDED.updated_at`,
      [row.id, row.project_id, row.source_entity_id, row.target_entity_id, row.type, row.label, Boolean(row.is_primary),
        jsonbValue(row.metadata_json, {}), row.created_at, row.updated_at]);
    count("relations", relations.length);

    const tags = rows(source, "SELECT id,project_id,slug,label,kind FROM tags");
    for (const row of tags) await insert(client,
      `INSERT INTO pp_tags (id,project_id,slug,label,kind) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,slug=EXCLUDED.slug,label=EXCLUDED.label,kind=EXCLUDED.kind`,
      [row.id, row.project_id, row.slug, row.label, row.kind]);
    const assignments = rows(source, "SELECT id,tag_id,entity_id FROM entity_tag_assignments");
    for (const row of assignments) await insert(client,
      `INSERT INTO pp_tag_assignments (id,tag_id,entity_id) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET tag_id=EXCLUDED.tag_id,entity_id=EXCLUDED.entity_id`,
      [row.id, row.tag_id, row.entity_id]);
    count("tags", tags.length); count("tagAssignments", assignments.length);

    const workspaces = rows(source, "SELECT id,project_id,repository_path,mode,source_url,status,attempt_id,owner_pid,deadline_at,created_at,updated_at,error_json FROM project_workspaces");
    for (const row of workspaces) await insert(client,
      `INSERT INTO pp_workspaces (id,project_id,repository_path,mode,source_url,status,attempt_id,owner_pid,deadline_at,created_at,updated_at,error_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET repository_path=EXCLUDED.repository_path,mode=EXCLUDED.mode,source_url=EXCLUDED.source_url,
         status=EXCLUDED.status,attempt_id=EXCLUDED.attempt_id,owner_pid=EXCLUDED.owner_pid,deadline_at=EXCLUDED.deadline_at,
         updated_at=EXCLUDED.updated_at,error_json=EXCLUDED.error_json`,
      [row.id, row.project_id, row.repository_path, row.mode, row.source_url, row.status, row.attempt_id, row.owner_pid,
        row.deadline_at, row.created_at, row.updated_at, jsonbValue(row.error_json, null)]);
    count("workspaces", workspaces.length);

    const sessions = rows(source, "SELECT id,project_id,title,status,session_json,context_entity_id,created_at,updated_at FROM assistant_sessions");
    for (const row of sessions) await insert(client,
      `INSERT INTO pp_assistant_sessions (id,project_id,title,status,session_json,context_entity_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,title=EXCLUDED.title,status=EXCLUDED.status,
         session_json=EXCLUDED.session_json,context_entity_id=EXCLUDED.context_entity_id,updated_at=EXCLUDED.updated_at`,
      [row.id, row.project_id, row.title, row.status, jsonbValue(row.session_json, {}), row.context_entity_id, row.created_at, row.updated_at]);
    count("assistantSessions", sessions.length);

    const agentRuns = rows(source, "SELECT id,agent_id,project_key,task,status,workspace_json,context_json,step_count,workflow_call_count,result_json,error,started_at,finished_at FROM agent_runs");
    for (const row of agentRuns) await insert(client,
      `INSERT INTO pp_agent_runs (id,agent_id,project_key,task,status,workspace_json,context_json,step_count,workflow_call_count,result_json,error,started_at,finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,workspace_json=EXCLUDED.workspace_json,context_json=EXCLUDED.context_json,
         step_count=EXCLUDED.step_count,workflow_call_count=EXCLUDED.workflow_call_count,result_json=EXCLUDED.result_json,
         error=EXCLUDED.error,finished_at=EXCLUDED.finished_at`,
      [row.id, row.agent_id, row.project_key, row.task, row.status, jsonbValue(row.workspace_json, null), jsonbValue(row.context_json, null),
        row.step_count, row.workflow_call_count, jsonbValue(row.result_json, null), row.error, row.started_at, row.finished_at]);
    const agentEvents = rows(source, "SELECT id,run_id,type,message,data_json,created_at FROM agent_run_events");
    for (const row of agentEvents) await insert(client,
      `INSERT INTO pp_agent_events (id,run_id,type,message,data_json,created_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type,message=EXCLUDED.message,data_json=EXCLUDED.data_json,created_at=EXCLUDED.created_at`,
      [row.id, row.run_id, row.type, row.message, jsonbValue(row.data_json, null), row.created_at]);
    count("agentRuns", agentRuns.length); count("agentEvents", agentEvents.length);

    const schemas = rows(source, `SELECT s.id,s.project_id,s.key,s.title,s.description,s.schema_json,s.status,
      COALESCE((SELECT MAX(version) FROM llm_json_schema_versions v WHERE v.schema_id=s.id),1) AS version
      FROM llm_json_schemas s`);
    for (const row of schemas) await insert(client,
      `INSERT INTO pp_llm_schemas (id,project_id,key,title,description,schema_json,status,version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,key=EXCLUDED.key,title=EXCLUDED.title,description=EXCLUDED.description,
         schema_json=EXCLUDED.schema_json,status=EXCLUDED.status,version=EXCLUDED.version`,
      [row.id, row.project_id, row.key, row.title, row.description, jsonbValue(row.schema_json, {}), row.status, row.version]);
    count("llmSchemas", schemas.length);

    const flows = entities.filter((row) => row.type === "flow");
    for (const flow of flows) {
      const graph = loadWorkflowGraph(source, flow.id);
      if (graph) await insert(client,
        `INSERT INTO pp_workflows (workflow_id,project_id,graph_json,triggers_json,updated_at) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (workflow_id) DO UPDATE SET project_id=EXCLUDED.project_id,graph_json=EXCLUDED.graph_json,
           triggers_json=EXCLUDED.triggers_json,updated_at=EXCLUDED.updated_at`,
        [flow.id, flow.project_id, jsonbValue(graph, { version: 4, nodes: [], edges: [] }), jsonbValue(listWorkflowTriggers(source, flow.id), []), flow.updated_at]);
    }
    count("workflows", flows.length);

    const flowProjectIds = new Map(flows.map((flow) => [flow.id, flow.project_id]));
    const runs = rows(source, "SELECT id,workflow_id,trigger_id,version_id,status,definition_snapshot_json,bag_json,error,started_at,finished_at FROM workflow_runs");
    for (const row of runs) {
      const projectId = flowProjectIds.get(row.workflow_id);
      if (!projectId) throw new Error(`Workflow run ${row.id} references missing flow ${row.workflow_id}.`);
      await insert(client,
      `INSERT INTO pp_workflow_runs (id,workflow_id,project_id,trigger_id,version_id,status,definition_snapshot_json,bag_json,error,started_at,finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,definition_snapshot_json=EXCLUDED.definition_snapshot_json,
         bag_json=EXCLUDED.bag_json,error=EXCLUDED.error,finished_at=EXCLUDED.finished_at`,
      [row.id, row.workflow_id, projectId, row.trigger_id, row.version_id, row.status, jsonbValue(row.definition_snapshot_json, { version: 4, nodes: [], edges: [] }), jsonbValue(row.bag_json, {}), row.error, row.started_at, row.finished_at]);
    }
    const nodeRuns = rows(source, "SELECT id,run_id,node_id,attempt,status,input_json,output_json,route_label,error_json,started_at,finished_at FROM workflow_node_runs");
    for (const row of nodeRuns) await insert(client,
      `INSERT INTO pp_workflow_node_runs (id,run_id,node_id,attempt,status,input_json,output_json,route_label,error_json,started_at,finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,input_json=EXCLUDED.input_json,output_json=EXCLUDED.output_json,
         route_label=EXCLUDED.route_label,error_json=EXCLUDED.error_json,started_at=EXCLUDED.started_at,finished_at=EXCLUDED.finished_at`,
      [row.id, row.run_id, row.node_id, row.attempt, row.status, jsonbValue(row.input_json, {}), jsonbValue(row.output_json, {}), row.route_label, jsonbValue(row.error_json, null), row.started_at, row.finished_at]);
    count("workflowRuns", runs.length); count("workflowNodeRuns", nodeRuns.length);

    await client.query("COMMIT");
    return counts;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
    source.close();
  }
}

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import assistant from "@projectplaner/core/assistant";
import workflow from "@projectplaner/core/workflow";
import type {
  AgentRun,
  AgentRunEvent,
  AssistantSession,
  AssistantSessionRecord,
  Entity,
  EntityFilter,
  EntityRelation,
  EntityRelationType,
  EntityStatus,
  EntityType,
  JsonRecord,
  ProjectPlanSnapshot,
  QueryPlan,
  WorkflowGraph
} from "@projectplaner/core";
import type { Storage, StorageConnection } from "../../contracts/storage";
import type { GenericPlanExport, GenericProjectSnapshot } from "../../contracts/snapshots";
import type { CreateEntityInput, EntityQuery, UpdateEntityInput } from "../../contracts/entities";
import type { CreateRelationInput, RelationQuery, UpdateRelationInput } from "../../contracts/relations";
import type { CreateProjectInput, ProjectStats, ProjectSummary } from "../../contracts/projects";
import type { CreateTaskInput } from "../../contracts/tasks";
import type { ProjectWorkspace, WorkspaceFailure } from "@projectplaner/core";
import type { LlmJsonSchemaRecord, CreateLlmJsonSchemaInput, EnsureLlmJsonSchemasOptions, EnsureLlmJsonSchemasResult } from "../../contracts/llm-json-schemas";
import type { WorkflowNodeRun, WorkflowNodeRunStatus, WorkflowRunRecord, WorkflowRunStatus, WorkflowTrigger, WorkflowTriggerKind } from "../../contracts/persist";
import type { Operations as Workspaces } from "../../contracts/project-workspaces";
import { parseAgentProfile } from "@projectplaner/core";

type Executor = { query<T extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
type Row = Record<string, any>;

const { emptySession, normalize, parseSession, titleFromSession } = assistant;
const { LLM_JSON_SCHEMA_PRESETS } = workflow.llm;

const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS pp_projects (
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  archived_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pp_entities (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL, key TEXT, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned', sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, type, slug)
);
CREATE INDEX IF NOT EXISTS pp_entities_project_type_idx ON pp_entities(project_id, type);
CREATE TABLE IF NOT EXISTS pp_relations (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE,
  source_entity_id TEXT NOT NULL REFERENCES pp_entities(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES pp_entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL, label TEXT, is_primary BOOLEAN NOT NULL DEFAULT FALSE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS pp_relations_project_idx ON pp_relations(project_id);
CREATE TABLE IF NOT EXISTS pp_tags (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'custom', UNIQUE(project_id, slug)
);
CREATE TABLE IF NOT EXISTS pp_tag_assignments (
  id TEXT PRIMARY KEY, tag_id TEXT NOT NULL REFERENCES pp_tags(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES pp_entities(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pp_workspaces (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE REFERENCES pp_projects(id) ON DELETE CASCADE,
  repository_path TEXT NOT NULL, mode TEXT NOT NULL, source_url TEXT, status TEXT NOT NULL,
  attempt_id TEXT NOT NULL, owner_pid INTEGER NOT NULL, deadline_at TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, error_json JSONB
);
CREATE TABLE IF NOT EXISTS pp_assistant_sessions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', session_json JSONB NOT NULL,
  context_entity_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS pp_sessions_project_status_idx ON pp_assistant_sessions(project_id, status, updated_at);
CREATE TABLE IF NOT EXISTS pp_agent_runs (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES pp_entities(id) ON DELETE CASCADE, project_key TEXT NOT NULL,
  task TEXT NOT NULL, status TEXT NOT NULL, workspace_json JSONB, context_json JSONB, step_count INTEGER NOT NULL DEFAULT 0,
  workflow_call_count INTEGER NOT NULL DEFAULT 0, result_json JSONB, error TEXT, started_at TEXT NOT NULL, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS pp_agent_events (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES pp_agent_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL, message TEXT NOT NULL, data_json JSONB, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pp_workflows (
  workflow_id TEXT PRIMARY KEY REFERENCES pp_entities(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE,
  graph_json JSONB NOT NULL, triggers_json JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pp_workflow_runs (
  id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES pp_entities(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE,
  trigger_id TEXT, version_id TEXT, status TEXT NOT NULL DEFAULT 'running', definition_snapshot_json JSONB NOT NULL,
  bag_json JSONB NOT NULL DEFAULT '{}'::jsonb, error TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS pp_workflow_runs_workflow_idx ON pp_workflow_runs(workflow_id);
CREATE TABLE IF NOT EXISTS pp_workflow_node_runs (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES pp_workflow_runs(id) ON DELETE CASCADE, node_id TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb, route_label TEXT, error_json JSONB, started_at TEXT, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS pp_workflow_node_runs_run_idx ON pp_workflow_node_runs(run_id);
CREATE TABLE IF NOT EXISTS pp_llm_schemas (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES pp_projects(id) ON DELETE CASCADE, key TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', schema_json JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1, UNIQUE(project_id, key)
);
`;

function json(value: unknown): unknown {
  return value === undefined ? null : value;
}

function now(): string { return new Date().toISOString(); }
function slugify(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"; }
function asObject(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function mapEntity(row: Row): Entity {
  return { id: row.id, projectId: row.project_id, type: row.type as EntityType, key: row.key ?? null, slug: row.slug, title: row.title, summary: row.summary ?? "", body: row.body ?? "", status: row.status as EntityStatus, sortOrder: Number(row.sort_order) || 0, metadata: asObject(row.metadata) };
}
function mapRelation(row: Row): EntityRelation {
  return { id: row.id, projectId: row.project_id, sourceEntityId: row.source_entity_id, targetEntityId: row.target_entity_id, type: row.type as EntityRelationType, label: row.label ?? null, isPrimary: Boolean(row.is_primary), metadata: asObject(row.metadata) };
}
function projectKey(value: string): string { return value.trim().toUpperCase(); }

function includesValue(actual: unknown, wanted: unknown): boolean {
  return Array.isArray(wanted) ? wanted.map(String).includes(String(actual)) : String(actual) === String(wanted);
}
function matchesFilter(entity: Entity, filter: any, relations: EntityRelation[], byId: Map<string, Entity>): boolean {
  if (!filter || filter.kind === "true") return true;
  if (filter.kind === "and") return filter.items.every((item: any) => matchesFilter(entity, item, relations, byId));
  if (filter.kind === "or") return filter.items.some((item: any) => matchesFilter(entity, item, relations, byId));
  if (filter.kind === "not") return !matchesFilter(entity, filter.item, relations, byId);
  if (filter.kind === "match") {
    const narrative = asObject(entity.metadata.narrative);
    const text = [entity.title, entity.slug, entity.summary, entity.body, narrative.reason, narrative.proposal, narrative.intent].join(" ").toLowerCase();
    return text.includes(String(filter.value).toLowerCase());
  }
  if (filter.kind === "field") {
    const actual = filter.field.startsWith("metadata.") ? filter.field.split(".").slice(1).reduce((v: any, key: string) => v?.[key], entity.metadata) : (entity as any)[filter.field];
    const equal = includesValue(actual, filter.value);
    return filter.op === "eq" ? equal : filter.op === "neq" ? !equal : Array.isArray(filter.value) && filter.value.some((v: unknown) => String(v) === String(actual));
  }
  if (filter.kind === "rel") {
    const related = relations.filter((relation) => {
      const touches = filter.direction === "out"
        ? relation.sourceEntityId === entity.id
        : filter.direction === "in"
          ? relation.targetEntityId === entity.id
          : relation.sourceEntityId === entity.id || relation.targetEntityId === entity.id;
      return touches && (!filter.types?.length || filter.types.includes(relation.type));
    }).map((relation) => {
      if (filter.direction === "out") return byId.get(relation.targetEntityId);
      if (filter.direction === "in") return byId.get(relation.sourceEntityId);
      return byId.get(relation.sourceEntityId === entity.id ? relation.targetEntityId : relation.sourceEntityId);
    }).filter(Boolean) as Entity[];
    const selected = filter.relatedWhere ? related.filter((item) => matchesFilter(item, filter.relatedWhere, relations, byId)) : related;
    return filter.quantifier === "none" ? selected.length === 0 : filter.quantifier === "every" ? related.every((item) => matchesFilter(item, filter.relatedWhere, relations, byId)) : selected.length > 0;
  }
  return true;
}

export async function ensurePostgresSchema(executor: Executor): Promise<void> { await executor.query(POSTGRES_SCHEMA); }

export class PostgresStorage implements Storage {
  readonly entities: Storage["entities"];
  readonly relations: Storage["relations"];
  readonly projects: Storage["projects"];
  readonly workspaces: Storage["workspaces"];
  readonly tasks: Storage["tasks"];
  readonly tags: Storage["tags"];
  readonly snapshots: Storage["snapshots"];
  readonly assistantSessions: Storage["assistantSessions"];
  readonly llmJsonSchemas: Storage["llmJsonSchemas"];
  readonly persist: Storage["persist"];
  readonly agentRuns: Storage["agentRuns"];
  readonly query: Storage["query"];
  readonly catalog: Storage["catalog"];

  constructor(private readonly pool: Pool, private readonly executor: Executor = pool) {
    this.entities = { create: this.createEntity.bind(this), get: this.getEntity.bind(this), list: this.listEntities.bind(this), update: this.updateEntity.bind(this), remove: this.removeEntity.bind(this) };
    this.relations = { create: this.createRelation.bind(this), get: this.getRelation.bind(this), list: this.listRelations.bind(this), update: this.updateRelation.bind(this), remove: this.removeRelation.bind(this) };
    this.projects = { list: this.listProjects.bind(this), create: this.createProject.bind(this), remove: this.removeProject.bind(this), stats: this.projectStats.bind(this), setArchived: this.setArchived.bind(this), findByKey: this.findProjectByKey.bind(this), keyForId: this.keyForId.bind(this) };
    this.workspaces = { get: this.getWorkspace.bind(this), reserve: this.reserveWorkspace.bind(this), finish: this.finishWorkspace.bind(this) };
    this.tasks = { create: this.createTask.bind(this) };
    this.tags = { list: this.listTags.bind(this) };
    this.snapshots = { get: this.getSnapshot.bind(this), getGeneric: this.getGenericSnapshot.bind(this), export: this.exportSnapshot.bind(this), import: this.importSnapshot.bind(this) };
    this.assistantSessions = { get: this.getSession.bind(this), list: this.listSessions.bind(this), getOrCreateActive: this.getOrCreateSession.bind(this), create: this.createSession.bind(this), save: this.saveSession.bind(this), archive: this.archiveSession.bind(this) };
    this.llmJsonSchemas = { getByKey: this.getSchema.bind(this), list: this.listSchemas.bind(this), create: this.createSchema.bind(this), ensure: this.ensureSchemas.bind(this) };
    this.persist = { loadGraph: this.loadGraph.bind(this), saveGraph: this.saveGraph.bind(this), getOrMigrateGraph: this.getOrMigrateGraph.bind(this), listTriggers: this.listTriggers.bind(this), createRun: this.createRun.bind(this), updateRun: this.updateRun.bind(this), recordNodeRun: this.recordNodeRun.bind(this), listNodeRuns: this.listNodeRuns.bind(this), getRun: this.getRun.bind(this) };
    this.agentRuns = { create: this.createAgentRun.bind(this), get: this.getAgentRun.bind(this), update: this.updateAgentRun.bind(this), finish: this.finishAgentRun.bind(this), list: this.listAgentRuns.bind(this), createEvent: this.createAgentEvent.bind(this), listEvents: this.listAgentEvents.bind(this) };
    this.query = { execute: this.executeQuery.bind(this), validate: async () => ({ errors: [], warnings: [] }) };
    this.catalog = { findPreset: this.findPreset.bind(this) };
  }

  async transaction<T>(run: (storage: Storage) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const scoped = new PostgresStorage(this.pool, client);
      const value = await run(scoped);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private async createEntity(input: CreateEntityInput): Promise<{ entity: Entity; warnings: string[] }> {
    const project = await this.findProjectByKey(input.projectKey);
    if (!project) throw new Error(`Project not found: ${input.projectKey}`);
    const title = input.title.trim(); if (!title) throw new Error("Entity title is required.");
    const id = `${input.type}_${randomUUID()}`;
    const entity: Entity = { id, projectId: project.id, type: input.type, key: input.key === undefined ? null : input.key, slug: slugify(input.slug ?? input.key ?? title), title, summary: input.summary?.trim() ?? "", body: input.body?.trim() ?? "", status: input.status ?? "planned", sortOrder: input.sortOrder ?? 0, metadata: input.metadata ?? {} };
    await this.executor.query(`INSERT INTO pp_entities (id,project_id,type,key,slug,title,summary,body,status,sort_order,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [entity.id, entity.projectId, entity.type, entity.key, entity.slug, entity.title, entity.summary, entity.body, entity.status, entity.sortOrder, entity.metadata]);
    for (const relation of input.relations ?? []) await this.createRelation({ projectKey: input.projectKey, sourceEntityId: id, targetEntityId: relation.targetEntityId, type: relation.type, label: relation.label, isPrimary: relation.isPrimary, metadata: relation.metadata });
    return { entity, warnings: [] };
  }
  private async getEntity(id: string): Promise<Entity | null> { const result = await this.executor.query<Row>("SELECT * FROM pp_entities WHERE id=$1", [id]); return result.rows[0] ? mapEntity(result.rows[0]) : null; }
  private async listEntities(query: EntityQuery = {}): Promise<Entity[]> { const project = query.projectKey ? await this.findProjectByKey(query.projectKey) : null; const result = await this.executor.query<Row>(`SELECT e.* FROM pp_entities e ${project ? "WHERE e.project_id=$1" : ""} ORDER BY e.sort_order,e.id`, project ? [project.id] : []); return result.rows.map(mapEntity).filter((entity) => (query.type ? entity.type === query.type : true) && (query.includeArchived || entity.status !== "archived") && (!query.query || [entity.title, entity.slug, entity.summary, entity.body].join(" ").toLowerCase().includes(query.query.toLowerCase()))); }
  private async updateEntity(input: UpdateEntityInput): Promise<Entity> { const current = await this.getEntity(input.id); if (!current) throw new Error("Entity not found."); const next = { ...current, ...input.patch, metadata: input.patch.metadata ?? current.metadata }; await this.executor.query(`UPDATE pp_entities SET key=$1,slug=$2,title=$3,summary=$4,body=$5,status=$6,sort_order=$7,metadata=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$9`, [next.key, next.slug, next.title, next.summary, next.body, next.status, next.sortOrder, next.metadata, next.id]); return next; }
  private async removeEntity(id: string): Promise<void> { await this.executor.query("UPDATE pp_entities SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [id]); }

  private async createRelation(input: CreateRelationInput): Promise<EntityRelation> { const source = await this.getEntity(input.sourceEntityId); const target = await this.getEntity(input.targetEntityId); if (!source || !target || source.projectId !== target.projectId) throw new Error("Relation endpoints must exist in the same project."); const relation: EntityRelation = { id: `ger_${randomUUID()}`, projectId: source.projectId, sourceEntityId: source.id, targetEntityId: target.id, type: input.type, label: input.label ?? null, isPrimary: input.isPrimary ?? false, metadata: input.metadata ?? {} }; await this.executor.query(`INSERT INTO pp_relations (id,project_id,source_entity_id,target_entity_id,type,label,is_primary,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [relation.id, relation.projectId, relation.sourceEntityId, relation.targetEntityId, relation.type, relation.label, relation.isPrimary, relation.metadata]); return relation; }
  private async getRelation(id: string): Promise<EntityRelation | null> { const result = await this.executor.query<Row>("SELECT * FROM pp_relations WHERE id=$1", [id]); return result.rows[0] ? mapRelation(result.rows[0]) : null; }
  private async listRelations(query: RelationQuery = {}): Promise<EntityRelation[]> { const clauses: string[] = []; const values: unknown[] = []; const add = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replace("$X", `$${values.length}`)); }; if (query.projectKey) add("p.key=$X", projectKey(query.projectKey)); if (query.sourceEntityId) add("r.source_entity_id=$X", query.sourceEntityId); if (query.targetEntityId) add("r.target_entity_id=$X", query.targetEntityId); if (query.type) add("r.type=$X", query.type); const result = await this.executor.query<Row>(`SELECT r.* FROM pp_relations r JOIN pp_projects p ON p.id=r.project_id ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY r.id`, values); return result.rows.map(mapRelation); }
  private async updateRelation(input: UpdateRelationInput): Promise<EntityRelation> { const current = await this.getRelation(input.id); if (!current) throw new Error("Relation not found."); const next = { ...current, ...input.patch, metadata: input.patch.metadata ?? current.metadata }; await this.executor.query("UPDATE pp_relations SET type=$1,label=$2,is_primary=$3,metadata=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$5", [next.type, next.label, next.isPrimary, next.metadata, next.id]); return next; }
  private async removeRelation(id: string): Promise<void> { await this.executor.query("DELETE FROM pp_relations WHERE id=$1", [id]); }

  private async listProjects(options: { includeArchived?: boolean } = {}): Promise<ProjectSummary[]> { const result = await this.executor.query<Row>("SELECT * FROM pp_projects ORDER BY key"); const out: ProjectSummary[] = []; for (const row of result.rows) { if (!options.includeArchived && row.archived_at) continue; const entities = await this.executor.query<Row>("SELECT COUNT(*)::int AS count FROM pp_entities WHERE project_id=$1 AND status <> 'archived'", [row.id]); const flows = await this.executor.query<Row>("SELECT COUNT(*)::int AS count FROM pp_workflows WHERE project_id=$1", [row.id]); const workspace = await this.getWorkspace(row.id); out.push({ id: row.id, key: row.key, title: row.title, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at ?? null, entityCount: Number(entities.rows[0]?.count ?? 0), workflowCount: Number(flows.rows[0]?.count ?? 0), workspace: workspace ? { id: workspace.id, status: workspace.status } : null }); } return out; }
  private async createProject(input: CreateProjectInput): Promise<{ project: ProjectSummary }> {
    return this.executor === this.pool
      ? this.transaction(async (storage) => (storage as PostgresStorage).createProjectRaw(input))
      : this.createProjectRaw(input);
  }
  private async createProjectRaw(input: CreateProjectInput): Promise<{ project: ProjectSummary }> {
    const key = projectKey(input.key);
    if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(key)) throw new Error("Invalid project key.");
    const title = input.title.trim();
    if (!title) throw new Error("Project title is required.");
    const id = `project_${randomUUID()}`;
    await this.executor.query("INSERT INTO pp_projects (id,key,title,description) VALUES ($1,$2,$3,$4)", [id, key, title, input.description?.trim() ?? ""]);
    await this.executor.query("INSERT INTO pp_entities (id,project_id,type,key,slug,title,summary,body,status,sort_order,metadata) VALUES ($1,$2,'project',$3,$4,$5,$6,$6,'in_progress',0,'{}')", [`project_${randomUUID()}`, id, key, slugify(key), title, input.description?.trim() ?? ""]);
    const project = (await this.listProjects()).find((item) => item.id === id);
    if (!project) throw new Error("Project was not created.");
    return { project };
  }
  private async removeProject(key: string): Promise<{ deleted: string }> {
    const normalizedKey = projectKey(key);
    if (normalizedKey === "PLAN") throw new Error("The PLAN project is protected.");
    const found = await this.findProjectByKey(normalizedKey);
    if (!found) throw new Error("Project not found.");
    await this.executor.query("DELETE FROM pp_projects WHERE id=$1", [found.id]);
    return { deleted: found.key };
  }
  private async projectStats(key: string): Promise<ProjectStats | null> { const project = await this.findProjectByKey(key); if (!project) return null; const entities = await this.listEntities({ projectKey: project.key, includeArchived: false }); const byType: ProjectStats["byType"] = {}; for (const entity of entities) { const bucket = byType[entity.type] ??= { total: 0, planning: 0, inProgress: 0, done: 0, other: 0 }; bucket.total++; if (["planned", "in_planning", "open"].includes(entity.status)) bucket.planning++; else if (entity.status === "in_progress") bucket.inProgress++; else if (["done", "accepted", "answered"].includes(entity.status)) bucket.done++; else bucket.other++; } const flows = await this.executor.query<Row>("SELECT COUNT(*)::int AS count FROM pp_workflows WHERE project_id=$1", [project.id]); return { project: { id: project.id, key: project.key, title: project.title, description: project.description }, byType, workflowDefs: Number(flows.rows[0]?.count ?? 0) }; }
  private async setArchived(key: string, archived: boolean): Promise<ProjectSummary> { const found = await this.findProjectByKey(key); if (!found) throw new Error("Project not found."); await this.executor.query("UPDATE pp_projects SET archived_at=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2", [archived ? now() : null, found.id]); return (await this.listProjects({ includeArchived: true })).find((item) => item.id === found.id)!; }
  private async findProjectByKey(key: string): Promise<{ id: string; key: string; archivedAt: string | null; title: string; description: string } | null> { const result = await this.executor.query<Row>("SELECT id,key,title,description,archived_at FROM pp_projects WHERE key=$1", [projectKey(key)]); const row = result.rows[0]; return row ? { id: row.id, key: row.key, title: row.title, description: row.description, archivedAt: row.archived_at ?? null } : null; }
  private async keyForId(id: string): Promise<string | undefined> { const result = await this.executor.query<Row>("SELECT key FROM pp_projects WHERE id=$1", [id]); return result.rows[0]?.key; }

  private async createTask(input: CreateTaskInput): Promise<{ id: string; key: string }> { const project = await this.findProjectByKey(input.projectKey); if (!project) throw new Error("Project not found."); const count = await this.executor.query<Row>("SELECT COUNT(*)::int AS count FROM pp_entities WHERE project_id=$1 AND type='task'", [project.id]); const key = `${project.key}-${Number(count.rows[0]?.count ?? 0) + 1}`; const created = await this.createEntity({ projectKey: project.key, type: "task", key, title: input.title, summary: input.description, body: input.description, status: input.status, metadata: { priority: input.priority, acceptanceCriteria: input.acceptanceCriteria }, relations: [{ targetEntityId: input.targetId, type: input.linkType, isPrimary: true }] }); return { id: created.entity.id, key }; }
  private async listTags(projectId: string): Promise<ProjectPlanSnapshot["tags"]> { const result = await this.executor.query<Row>("SELECT * FROM pp_tags WHERE project_id=$1 ORDER BY slug", [projectId]); return result.rows.map((row) => ({ id: row.id, projectId: row.project_id, slug: row.slug, label: row.label, kind: row.kind })); }

  private async loadGenericSnapshot(key = "PLAN", includeArchived = false): Promise<GenericProjectSnapshot | null> { const project = await this.findProjectByKey(key); if (!project) return null; const entities = await this.listEntities({ projectKey: project.key, includeArchived }); const relations = await this.listRelations({ projectKey: project.key }); const tags = await this.listTags(project.id); const tagRows = await this.executor.query<Row>("SELECT id,tag_id,entity_id FROM pp_tag_assignments WHERE tag_id IN (SELECT id FROM pp_tags WHERE project_id=$1)", [project.id]); return { project: { id: project.id, key: project.key, title: project.title, description: project.description }, entities, relations, tags, tagAssignments: tagRows.rows.map((row) => ({ id: row.id, tagId: row.tag_id, entityId: row.entity_id })) }; }
  private async getGenericSnapshot(key = "PLAN", options: { includeArchived?: boolean } = {}): Promise<GenericProjectSnapshot | null> { return this.loadGenericSnapshot(key, options.includeArchived ?? false); }
  private async getSnapshot(key = "PLAN", options: { includeArchived?: boolean } = {}): Promise<ProjectPlanSnapshot | null> { const generic = await this.loadGenericSnapshot(key, options.includeArchived ?? false); if (!generic) return null; const byId = new Map(generic.entities.map((entity) => [entity.id, entity])); return { project: generic.project, nodes: generic.entities.filter((e) => e.type !== "feature" && e.type !== "task").map((e) => ({ ...e, type: e.type as any, parentId: null, path: e.slug })), relations: generic.relations.filter((r) => !["implements", "affects", "validates", "investigates"].includes(r.type)).map((r) => ({ id: r.id, projectId: r.projectId, sourceNodeId: r.sourceEntityId, targetNodeId: r.targetEntityId, type: r.type as any, label: r.label, metadata: r.metadata })), draftPlans: [], draftChanges: [], features: generic.entities.filter((e) => e.type === "feature").map((e) => ({ ...e, key: e.key ?? e.slug, parentFeatureId: null, acceptanceShape: "" })), featureAspectLinks: [], tasks: generic.entities.filter((e) => e.type === "task").map((e) => ({ id: e.id, projectId: e.projectId, key: e.key ?? e.slug, title: e.title, description: e.body || e.summary, status: e.status as any, priority: (e.metadata.priority ?? "medium") as any, acceptanceCriteria: Array.isArray(e.metadata.acceptanceCriteria) ? e.metadata.acceptanceCriteria : [], sortOrder: e.sortOrder, metadata: e.metadata })), taskLinks: generic.relations.filter((r) => ["implements", "affects", "validates", "investigates"].includes(r.type)).map((r) => ({ id: r.id, taskId: r.sourceEntityId, targetType: byId.get(r.targetEntityId)?.type === "feature" ? "feature" : "aspect", targetId: r.targetEntityId, type: r.type as any, isPrimary: r.isPrimary })), entityRelations: [], tags: generic.tags, tagAssignments: generic.tagAssignments.map((a) => ({ ...a, targetType: byId.get(a.entityId)?.type ?? "reference", targetId: a.entityId })) }; }
  private async exportSnapshot(key = "PLAN"): Promise<GenericPlanExport> { const result = await this.getGenericSnapshot(key); if (!result) throw new Error("Project not found."); return result; }
  private async importSnapshot(input: GenericPlanExport): Promise<void> { await this.executor.query("INSERT INTO pp_projects (id,key,title,description) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description", [input.project.id, input.project.key, input.project.title, input.project.description]); await this.executor.query("DELETE FROM pp_relations WHERE project_id=$1", [input.project.id]); await this.executor.query("DELETE FROM pp_entities WHERE project_id=$1", [input.project.id]); for (const entity of input.entities) await this.executor.query("INSERT INTO pp_entities (id,project_id,type,key,slug,title,summary,body,status,sort_order,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [entity.id, entity.projectId, entity.type, entity.key, entity.slug, entity.title, entity.summary, entity.body, entity.status, entity.sortOrder, entity.metadata]); for (const relation of input.relations) await this.executor.query("INSERT INTO pp_relations (id,project_id,source_entity_id,target_entity_id,type,label,is_primary,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [relation.id, relation.projectId, relation.sourceEntityId, relation.targetEntityId, relation.type, relation.label, relation.isPrimary, relation.metadata]); }

  private async getWorkspace(projectId: string): Promise<ProjectWorkspace | null> { const result = await this.executor.query<Row>("SELECT * FROM pp_workspaces WHERE project_id=$1", [projectId]); const row = result.rows[0]; return row ? { id: row.id, projectId: row.project_id, repositoryPath: row.repository_path, mode: row.mode, sourceUrl: row.source_url ?? null, status: row.status, attemptId: row.attempt_id, ownerPid: row.owner_pid, deadlineAt: row.deadline_at, createdAt: row.created_at, updatedAt: row.updated_at, lastError: row.error_json ?? null } : null; }
  private async reserveWorkspace(workspace: ProjectWorkspace, retry: boolean): Promise<boolean> { if (retry) { const result = await this.executor.query("UPDATE pp_workspaces SET status='provisioning',attempt_id=$1,owner_pid=$2,deadline_at=$3,updated_at=$4,error_json=NULL WHERE project_id=$5 AND status='failed'", [workspace.attemptId, workspace.ownerPid, workspace.deadlineAt, workspace.updatedAt, workspace.projectId]); return result.rowCount === 1; } const result = await this.executor.query("INSERT INTO pp_workspaces (id,project_id,repository_path,mode,source_url,status,attempt_id,owner_pid,deadline_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,'provisioning',$6,$7,$8,$9,$10) ON CONFLICT (project_id) DO NOTHING", [workspace.id, workspace.projectId, workspace.repositoryPath, workspace.mode, workspace.sourceUrl, workspace.attemptId, workspace.ownerPid, workspace.deadlineAt, workspace.createdAt, workspace.updatedAt]); return result.rowCount === 1; }
  private async finishWorkspace(workspace: ProjectWorkspace, error: WorkspaceFailure | null): Promise<void> { await this.executor.query("UPDATE pp_workspaces SET status=$1,error_json=$2,updated_at=$3 WHERE id=$4 AND attempt_id=$5 AND status='provisioning'", [error ? "failed" : "ready", json(error), now(), workspace.id, workspace.attemptId]); }

  private async getSession(id: string): Promise<AssistantSessionRecord | null> { const result = await this.executor.query<Row>("SELECT s.*,p.key AS project_key FROM pp_assistant_sessions s JOIN pp_projects p ON p.id=s.project_id WHERE s.id=$1", [id]); const row = result.rows[0]; if (!row) return null; const session = normalize(parseSession(row.session_json, row.project_key)); return { id: row.id, projectId: row.project_id, title: row.title, status: row.status, session, contextEntityId: row.context_entity_id ?? null, createdAt: row.created_at, updatedAt: row.updated_at }; }
  private async listSessions(key: string, options: { includeArchived?: boolean } = {}): Promise<AssistantSessionRecord[]> { const project = await this.findProjectByKey(key); if (!project) return []; const result = await this.executor.query<Row>(`SELECT s.*,p.key AS project_key FROM pp_assistant_sessions s JOIN pp_projects p ON p.id=s.project_id WHERE s.project_id=$1 ${options.includeArchived ? "" : "AND s.status='active'"} ORDER BY s.updated_at DESC`, [project.id]); return result.rows.map((row) => ({ id: row.id, projectId: row.project_id, title: row.title, status: row.status, session: normalize(parseSession(row.session_json, row.project_key)), contextEntityId: row.context_entity_id ?? null, createdAt: row.created_at, updatedAt: row.updated_at })); }
  private async createSession(key: string): Promise<AssistantSessionRecord> { const project = await this.findProjectByKey(key); if (!project) throw new Error("Unknown project."); const id = `asst_${randomUUID()}`; const session = emptySession(project.key); await this.executor.query("INSERT INTO pp_assistant_sessions (id,project_id,title,session_json,context_entity_id) VALUES ($1,$2,$3,$4,NULL)", [id, project.id, titleFromSession(session), session]); return (await this.getSession(id))!; }
  private async getOrCreateSession(key: string): Promise<AssistantSessionRecord> { const sessions = await this.listSessions(key); return sessions[0] ?? this.createSession(key); }
  private async saveSession(id: string, session: AssistantSession): Promise<AssistantSessionRecord> { const existing = await this.getSession(id); if (!existing) throw new Error("Unknown assistant session."); const next = normalize(session); await this.executor.query("UPDATE pp_assistant_sessions SET title=$1,session_json=$2,context_entity_id=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4", [titleFromSession(next), next, next.context.entityId ?? null, id]); return (await this.getSession(id))!; }
  private async archiveSession(id: string): Promise<AssistantSessionRecord> { await this.executor.query("UPDATE pp_assistant_sessions SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [id]); return (await this.getSession(id))!; }

  private async getSchema(key: string, projectKey = "PLAN"): Promise<LlmJsonSchemaRecord | null> { const project = await this.findProjectByKey(projectKey); if (!project) return null; const result = await this.executor.query<Row>("SELECT * FROM pp_llm_schemas WHERE project_id=$1 AND key=$2", [project.id, key]); const row = result.rows[0]; return row ? { id: row.id, projectId: row.project_id, key: row.key, title: row.title, description: row.description, schema: asObject(row.schema_json), status: row.status, version: row.version } : null; }
  private async listSchemas(projectKey = "PLAN"): Promise<LlmJsonSchemaRecord[]> { const project = await this.findProjectByKey(projectKey); if (!project) return []; const result = await this.executor.query<Row>("SELECT * FROM pp_llm_schemas WHERE project_id=$1 ORDER BY key", [project.id]); return result.rows.map((row) => ({ id: row.id, projectId: row.project_id, key: row.key, title: row.title, description: row.description, schema: asObject(row.schema_json), status: row.status, version: row.version })); }
  private async createSchema(input: CreateLlmJsonSchemaInput): Promise<LlmJsonSchemaRecord> { const project = await this.findProjectByKey(input.projectKey ?? "PLAN"); if (!project) throw new Error("Project not found."); const id = `ljs_${randomUUID()}`; await this.executor.query("INSERT INTO pp_llm_schemas (id,project_id,key,title,description,schema_json) VALUES ($1,$2,$3,$4,$5,$6)", [id, project.id, input.key, input.title, input.description?.trim() ?? "", input.schema]); return (await this.getSchema(input.key, project.key))!; }
  private async ensureSchemas(options: EnsureLlmJsonSchemasOptions = {}): Promise<EnsureLlmJsonSchemasResult> { const projectKey = options.projectKey ?? "PLAN"; const project = await this.findProjectByKey(projectKey); const result: EnsureLlmJsonSchemasResult = { seeded: [], skipped: [], reseeded: [] }; if (!project) return result; for (const preset of LLM_JSON_SCHEMA_PRESETS.filter((item) => !options.only?.length || options.only.includes(item.key))) { const existing = await this.getSchema(preset.key, project.key); if (!existing) { await this.createSchema({ projectKey: project.key, key: preset.key, title: preset.title, description: preset.description, schema: preset.schema }); result.seeded.push(preset.key); } else if (!options.force || JSON.stringify(existing.schema) === JSON.stringify(preset.schema)) result.skipped.push(preset.key); else { await this.executor.query("UPDATE pp_llm_schemas SET schema_json=$1,version=version+1,title=$2,description=$3 WHERE id=$4", [preset.schema, preset.title, preset.description, existing.id]); result.reseeded.push(preset.key); } } return result; }

  private async loadGraph(workflowId: string): Promise<WorkflowGraph | null> { const result = await this.executor.query<Row>("SELECT graph_json FROM pp_workflows WHERE workflow_id=$1", [workflowId]); return result.rows[0]?.graph_json ?? null; }
  private async saveGraph(input: { workflowId: string; projectId: string; graph: WorkflowGraph }): Promise<WorkflowGraph> { await this.executor.query("INSERT INTO pp_workflows (workflow_id,project_id,graph_json) VALUES ($1,$2,$3) ON CONFLICT (workflow_id) DO UPDATE SET graph_json=EXCLUDED.graph_json,updated_at=CURRENT_TIMESTAMP", [input.workflowId, input.projectId, input.graph]); return input.graph; }
  private async getOrMigrateGraph(input: { workflowId: string; projectId: string; metadata: JsonRecord }): Promise<WorkflowGraph | null> { const existing = await this.loadGraph(input.workflowId); if (existing) return existing; const graph = input.metadata.graph as WorkflowGraph | undefined; return graph ? this.saveGraph({ workflowId: input.workflowId, projectId: input.projectId, graph }) : null; }
  private async listTriggers(workflowId: string): Promise<WorkflowTrigger[]> { const result = await this.executor.query<Row>("SELECT triggers_json FROM pp_workflows WHERE workflow_id=$1", [workflowId]); const triggers = result.rows[0]?.triggers_json; return Array.isArray(triggers) ? triggers : [{ id: `wtrig_${workflowId}`, workflowId, kind: "manual", enabled: true, config: {} }]; }
  private async createRun(input: { workflowId: string; projectId: string; graph: WorkflowGraph; bag?: JsonRecord; triggerId?: string | null }): Promise<WorkflowRunRecord> { const id = `wrun_${randomUUID()}`; const startedAt = now(); await this.executor.query("INSERT INTO pp_workflow_runs (id,workflow_id,project_id,trigger_id,status,definition_snapshot_json,bag_json,started_at) VALUES ($1,$2,$3,$4,'running',$5,$6,$7)", [id, input.workflowId, input.projectId, input.triggerId ?? null, input.graph, input.bag ?? {}, startedAt]); return { id, workflowId: input.workflowId, triggerId: input.triggerId ?? null, versionId: null, status: "running", definitionSnapshot: input.graph, bag: input.bag ?? {}, error: null, startedAt, finishedAt: null }; }
  private async updateRun(input: { id: string; status?: WorkflowRunStatus; bag?: JsonRecord; error?: string | null; finished?: boolean }): Promise<void> { await this.executor.query(`UPDATE pp_workflow_runs SET status=COALESCE($1,status),bag_json=COALESCE($2,bag_json),error=$3,finished_at=CASE WHEN $4 THEN CURRENT_TIMESTAMP::text ELSE finished_at END WHERE id=$5`, [input.status ?? null, input.bag ?? null, input.error ?? null, Boolean(input.finished), input.id]); }
  private async recordNodeRun(input: { runId: string; nodeId: string; attempt?: number; status: WorkflowNodeRunStatus; input?: JsonRecord; output?: JsonRecord; routeLabel?: string | null; error?: JsonRecord | null }): Promise<WorkflowNodeRun> { const id = `wnrun_${randomUUID()}`; const startedAt = input.status === "pending" ? null : now(); const finishedAt = ["succeeded", "failed", "cancelled"].includes(input.status) ? now() : null; await this.executor.query("INSERT INTO pp_workflow_node_runs (id,run_id,node_id,attempt,status,input_json,output_json,route_label,error_json,started_at,finished_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [id, input.runId, input.nodeId, input.attempt ?? 1, input.status, input.input ?? {}, input.output ?? {}, input.routeLabel ?? null, input.error ?? null, startedAt, finishedAt]); return { id, runId: input.runId, nodeId: input.nodeId, attempt: input.attempt ?? 1, status: input.status, input: input.input ?? {}, output: input.output ?? {}, routeLabel: input.routeLabel ?? null, error: input.error ?? null, startedAt, finishedAt }; }
  private async listNodeRuns(runId: string): Promise<WorkflowNodeRun[]> { const result = await this.executor.query<Row>("SELECT * FROM pp_workflow_node_runs WHERE run_id=$1 ORDER BY started_at NULLS FIRST,id", [runId]); return result.rows.map((row) => ({ id: row.id, runId: row.run_id, nodeId: row.node_id, attempt: row.attempt, status: row.status, input: asObject(row.input_json), output: asObject(row.output_json), routeLabel: row.route_label ?? null, error: row.error_json ?? null, startedAt: row.started_at ?? null, finishedAt: row.finished_at ?? null })); }
  private async getRun(id: string): Promise<WorkflowRunRecord | null> { const result = await this.executor.query<Row>("SELECT * FROM pp_workflow_runs WHERE id=$1", [id]); const row = result.rows[0]; return row ? { id: row.id, workflowId: row.workflow_id, triggerId: row.trigger_id ?? null, versionId: row.version_id ?? null, status: row.status, definitionSnapshot: row.definition_snapshot_json, bag: asObject(row.bag_json), error: row.error ?? null, startedAt: row.started_at, finishedAt: row.finished_at ?? null } : null; }

  private async createAgentRun(run: AgentRun): Promise<AgentRun> { await this.executor.query("INSERT INTO pp_agent_runs (id,agent_id,project_key,task,status,workspace_json,context_json,step_count,workflow_call_count,result_json,error,started_at,finished_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)", [run.id, run.agentId, run.projectKey, run.task, run.status, json(run.workspace), json(run.context), run.stepCount, run.workflowCallCount, json(run.result), run.error ?? null, run.startedAt, run.finishedAt ?? null]); return run; }
  private async getAgentRun(id: string): Promise<AgentRun | null> { const result = await this.executor.query<Row>("SELECT * FROM pp_agent_runs WHERE id=$1", [id]); const row = result.rows[0]; return row ? { id: row.id, agentId: row.agent_id, projectKey: row.project_key, task: row.task, status: row.status, workspace: row.workspace_json ?? undefined, context: row.context_json ?? undefined, stepCount: row.step_count, workflowCallCount: row.workflow_call_count, result: row.result_json ?? undefined, error: row.error ?? undefined, startedAt: row.started_at, finishedAt: row.finished_at ?? undefined } : null; }
  private async updateAgentRun(run: AgentRun): Promise<AgentRun> { await this.executor.query("UPDATE pp_agent_runs SET status=$1,workspace_json=$2,context_json=$3,step_count=$4,workflow_call_count=$5,result_json=$6,error=$7,finished_at=$8 WHERE id=$9", [run.status, json(run.workspace), json(run.context), run.stepCount, run.workflowCallCount, json(run.result), run.error ?? null, run.finishedAt ?? null, run.id]); return run; }
  private async finishAgentRun(run: AgentRun): Promise<AgentRun> { return this.updateAgentRun(run); }
  private async listAgentRuns(agentId: string, key?: string): Promise<AgentRun[]> { const result = await this.executor.query<Row>(`SELECT * FROM pp_agent_runs WHERE agent_id=$1 ${key ? "AND project_key=$2" : ""} ORDER BY started_at DESC`, key ? [agentId, key] : [agentId]); return Promise.all(result.rows.map((row) => this.getAgentRun(row.id).then((value) => value!))); }
  private async createAgentEvent(event: AgentRunEvent): Promise<AgentRunEvent> { await this.executor.query("INSERT INTO pp_agent_events (id,run_id,type,message,data_json,created_at) VALUES ($1,$2,$3,$4,$5,$6)", [event.id, event.runId, event.type, event.message, json(event.data), event.createdAt]); return event; }
  private async listAgentEvents(runId: string, afterId?: string): Promise<AgentRunEvent[]> { const result = await this.executor.query<Row>(`SELECT * FROM pp_agent_events WHERE run_id=$1 ${afterId ? "AND created_at > (SELECT created_at FROM pp_agent_events WHERE id=$2)" : ""} ORDER BY created_at,id`, afterId ? [runId, afterId] : [runId]); return result.rows.map((row) => ({ id: row.id, runId: row.run_id, type: row.type, message: row.message, data: row.data_json ?? undefined, createdAt: row.created_at })); }

  private async executeQuery(plan: QueryPlan): Promise<Entity[]> { const entities = await this.listEntities({ projectKey: plan.projectKey, includeArchived: false }); const relations = await this.listRelations({ projectKey: plan.projectKey }); const byId = new Map(entities.map((entity) => [entity.id, entity])); const filtered = entities.filter((entity) => matchesFilter(entity, plan.where, relations, byId)); filtered.sort((a, b) => { for (const order of plan.orderBy) { const av = order.field === "sortOrder" ? a.sortOrder : order.field === "title" ? a.title : a.status; const bv = order.field === "sortOrder" ? b.sortOrder : order.field === "title" ? b.title : b.status; const result = String(av).localeCompare(String(bv), undefined, { numeric: true }); if (result) return order.dir === "desc" ? -result : result; } return 0; }); return filtered.slice(plan.offset ?? 0, plan.limit === undefined ? undefined : (plan.offset ?? 0) + plan.limit); }
  private async findPreset(projectKey: string, presetKey: string): Promise<{ id: string; projectId: string; metadata: JsonRecord; title: string } | null> { const project = await this.findProjectByKey(projectKey); if (!project) return null; const result = await this.executor.query<Row>("SELECT id,project_id,metadata,title FROM pp_entities WHERE project_id=$1 AND type='flow' AND metadata->>'presetKey'=$2 LIMIT 1", [project.id, presetKey]); const row = result.rows[0]; return row ? { id: row.id, projectId: row.project_id, metadata: asObject(row.metadata), title: row.title } : null; }
}

export async function openPostgres(databaseUrl: string): Promise<StorageConnection> {
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });
  try { await ensurePostgresSchema(pool); return { storage: new PostgresStorage(pool), close: () => pool.end() }; }
  catch (error) { await pool.end().catch(() => undefined); throw error; }
}

export function postgresStorage(pool: Pool, client?: PoolClient): Storage { return new PostgresStorage(pool, client ?? pool); }

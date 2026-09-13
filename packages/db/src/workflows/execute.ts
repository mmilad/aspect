import { parseAgentProfile } from "@projectplaner/core";
import type {
  Entity,
  EntityFilter,
  EntityListQuery,
  EntityRelationType,
  EntityStatus,
  EntityType,
  JsonRecord,
  RankedTaskCandidate,
  WorkflowAdapters,
  WorkflowContextBag,
  WorkflowMatch,
  WorkflowStepResult
} from "@projectplaner/core";
import domain from "@projectplaner/core/domain";
import planApi from "@projectplaner/core/plan-api";
import query from "@projectplaner/core/query";
import workflow from "@projectplaner/core/workflow";
import type { Storage } from "../contracts/storage";
import { listWorkspaceFiles, readWorkspaceFile } from "@projectplaner/workspace";
import { findSeededWorkflowPreset } from "../presets";
import { rollupParentStatus } from "../rollup";
import { entityStore } from "../contracts/storage";
import { createWebSearchProvider } from "../web-search";
import {
  createConfiguredKnowledgeGetProvider,
  createConfiguredKnowledgeIngestProvider,
  createConfiguredKnowledgeIngestTextProvider,
  createConfiguredKnowledgeSearchProvider
} from "../knowledge";
import {
  type WorkflowNodeRun,
  type WorkflowRunRecord,
  type WorkflowRunStatus
} from "../contracts/persist";

const { compileListQuery } = query;
const { create: createPlanApi } = planApi;
const { compactEntity, taskPriority } = domain;
const { createContextBag, findStartNode, parseContextBag } = workflow.graph;
const { walkNeighborhood } = workflow.nodes;
const { runUntilPause: runWorkflowUntilPause, step: stepWorkflow } = workflow.runtime;

function asEntityType(value: unknown, fallback: EntityType): EntityType {
  return typeof value === "string" ? (value as EntityType) : fallback;
}

function asStatus(value: unknown, fallback: EntityStatus): EntityStatus {
  return typeof value === "string" ? (value as EntityStatus) : fallback;
}

function writeResultKey(args: Record<string, unknown>, fallback: string): string {
  if (typeof args.resultAs === "string" && args.resultAs.trim()) {
    return args.resultAs.trim();
  }
  if (typeof args.resultKey === "string" && args.resultKey.trim()) {
    return args.resultKey.trim();
  }
  return fallback;
}

function asRelationType(value: unknown, fallback: EntityRelationType): EntityRelationType {
  return typeof value === "string" && value.trim() ? (value.trim() as EntityRelationType) : fallback;
}

function createEntityMetadata(args: Record<string, unknown>, reason: string): JsonRecord {
  const extra =
    args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
      ? (args.metadata as JsonRecord)
      : {};
  const metadata: JsonRecord = {
    ...extra,
    narrative: {
      reason,
      updatedAt: new Date().toISOString(),
      updatedBy: "workflow"
    }
  };
  if (typeof args.kind === "string" && args.kind.trim()) {
    metadata.kind = args.kind.trim();
  }
  if (args.document !== undefined) {
    if (args.type === "agent" && args.document && typeof args.document === "object" && !Array.isArray(args.document)) {
      const profile = args.document as JsonRecord;
      metadata.document = parseAgentProfile({
        ...profile,
        name: typeof profile.name === "string" ? profile.name : args.title,
        role: typeof profile.role === "string" ? profile.role : args.title,
        history: []
      });
    } else {
      metadata.document = args.document;
    }
  }
  return metadata;
}

function relatedToWhere(relatedTo: string): EntityFilter {
  return {
    rel: {
      direction: "out",
      some: { field: "id", op: "eq", value: relatedTo }
    }
  };
}

function andWhere(parts: EntityFilter[]): EntityFilter | undefined {
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { and: parts };
}

function toMatch(entity: { id: string; type: EntityType; title: string; status: string; summary?: string; score?: number }): WorkflowMatch {
  return {
    id: entity.id,
    type: entity.type,
    title: entity.title,
    status: entity.status,
    summary: entity.summary,
    score: entity.score
  };
}

/** Build runtime adapters that read/write the living SQLite graph. */
export function createWorkflowAdapters(
  db: Storage,
  projectKey = "PLAN"
): WorkflowAdapters {
  const store = entityStore(db);
  const api = createPlanApi(store);
  const knowledgeSearch = createConfiguredKnowledgeSearchProvider(projectKey);
  const knowledgeGet = createConfiguredKnowledgeGetProvider(projectKey);
  const knowledgeIngest = createConfiguredKnowledgeIngestProvider();
  const knowledgeIngestText = createConfiguredKnowledgeIngestTextProvider();
  const resolveWorkspaceRoot = async (): Promise<string> => {
    const project = await db.projects.findByKey(projectKey);
    if (!project || project.archivedAt) throw new Error(`Project '${projectKey}' is not available.`);
    const workspace = await db.workspaces.get(project.id);
    if (!workspace || workspace.status !== "ready") {
      throw new Error(`Project '${projectKey}' has no ready managed workspace.`);
    }
    return workspace.repositoryPath;
  };

  return {
    webSearch: (input) => createWebSearchProvider().search(input),
    knowledgeSearch,
    knowledgeGet,
    knowledgeIngest,
    knowledgeIngestText,
    fileList: async (input) => listWorkspaceFiles(await resolveWorkspaceRoot(), input),
    fileRead: async (input) => readWorkspaceFile(await resolveWorkspaceRoot(), input),
    getEntity: async (id) => (await db.entities.get(id)),
    listEntities: async (listQuery: EntityListQuery, options) =>
      (await db.query.execute(compileListQuery({ ...listQuery, projectKey: listQuery.projectKey ?? projectKey }, options))),
    searchEntities: async (input) => {
      const parts: EntityFilter[] = [];
      if (input.types?.length === 1) {
        parts.push({ field: "type", op: "eq", value: input.types[0]! });
      } else if (input.types && input.types.length > 1) {
        parts.push({ field: "type", op: "in", value: input.types });
      }
      if (input.relatedTo) {
        parts.push(relatedToWhere(input.relatedTo));
      }
      const result = await api.entities.search({
        projectKey,
        q: input.q,
        where: andWhere(parts),
        limit: input.limit,
        includeArchived: input.includeArchived,
        select: input.select
      });
      return result.items.map((item) => toMatch({ ...item, score: item.score }));
    },
    nextWork: async (input) => {
      const result = await api.tasks.nextWork({
        projectKey,
        relatedTo: input.relatedTo ? { id: input.relatedTo } : undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
        select: "full"
      });
      return result.items.map((item) => {
        const entity = item as Entity;
        return {
          id: entity.id,
          type: "task" as const,
          key: entity.key,
          title: entity.title,
          status: entity.status,
          summary: entity.summary,
          priority: taskPriority(entity),
          workScore: item.score
        } satisfies RankedTaskCandidate;
      });
    },
    neighborhood: async (input) => {
      const graphEntities = await db.entities.list({
        projectKey,
        includeArchived: input.includeArchived === true
      });
      const graphRelations = await db.relations.list({ projectKey });
      return walkNeighborhood(input.id, input.depth, graphEntities, graphRelations, input.select ?? "compact");
    },
    loadContext: async ({ query, types, limit, mode }) => {
      if (mode === "all") {
        const rows = await db.query.execute(compileListQuery(
            { projectKey, limit },
            types?.length === 1 ? { type: types[0] } : undefined
          ));
        const filtered = types && types.length > 1 ? rows.filter((row) => types.includes(row.type)) : rows;
        return filtered.map((entity) => toMatch(compactEntity(entity)));
      }
      const result = await api.entities.search({
        projectKey,
        q: query,
        where: types?.length
          ? types.length === 1
            ? { field: "type", op: "eq", value: types[0]! }
            : { field: "type", op: "in", value: types }
          : undefined,
        limit
      });
      return result.items.map((item) => toMatch({ ...item, score: item.score }));
    },
    runWrite: async ({ action, args }) => {
      if (action === "create_entity") {
        const title = typeof args.title === "string" ? args.title.trim() : "";
        if (!title) {
          throw new Error("create_entity requires title.");
        }
        const reason =
          typeof args.reason === "string" && args.reason.trim()
            ? args.reason.trim()
            : "Workflow write: create_entity";
        const parentAspectId =
          typeof args.parentAspectId === "string" && args.parentAspectId.trim()
            ? args.parentAspectId.trim()
            : undefined;
        const linkFrom =
          typeof args.linkFrom === "string" && args.linkFrom.trim() ? args.linkFrom.trim() : "";
        const resultKey = writeResultKey(args, "aspectId");

        const created = await db.entities.create({
          projectKey,
          type: asEntityType(args.type, "aspect"),
          title,
          summary: typeof args.summary === "string" ? args.summary : "",
          key: typeof args.key === "string" ? args.key : null,
          status: asStatus(args.status, "planned"),
          metadata: createEntityMetadata(args, reason),
          relations: parentAspectId
            ? [{ targetEntityId: parentAspectId, type: "supports" as const }]
            : undefined
        });

        if (linkFrom) {
          const source = await db.entities.get(linkFrom);
          if (!source) {
            throw new Error(`create_entity linkFrom '${linkFrom}' not found.`);
          }
          await db.relations.create({
            projectKey,
            sourceEntityId: linkFrom,
            targetEntityId: created.entity.id,
            type: asRelationType(args.linkType, "references")
          });
        }

        return { values: { [resultKey]: created.entity.id } };
      }

      if (action === "update_entity") {
        const id = typeof args.id === "string" ? args.id : typeof args.entityId === "string" ? args.entityId : "";
        if (!id) {
          throw new Error("update_entity requires id.");
        }
        const reason =
          typeof args.reason === "string" && args.reason.trim()
            ? args.reason.trim()
            : "Workflow write: update_entity";
        const resultKey = writeResultKey(args, "entityId");
        const patch: Parameters<Storage["entities"]["update"]>[0]["patch"] = {};
        if (typeof args.title === "string") {
          patch.title = args.title;
        }
        if (typeof args.summary === "string") {
          patch.summary = args.summary;
        }
        if (typeof args.status === "string") {
          patch.status = asStatus(args.status, "planned");
        }
        const current = await db.entities.get(id);
        if (!current) {
          throw new Error(`update_entity target ${id} not found.`);
        }
        patch.metadata = {
          ...current.metadata,
          narrative: {
            reason,
            updatedAt: new Date().toISOString(),
            updatedBy: "workflow"
          }
        };
        const updated = await db.entities.update({ id, patch });
        return { values: { [resultKey]: updated.id } };
      }

      if (action === "rollup_parent_status") {
        const entityId =
          typeof args.entityId === "string"
            ? args.entityId
            : typeof args.id === "string"
              ? args.id
              : "";
        if (!entityId) {
          throw new Error("rollup_parent_status requires entityId.");
        }
        const result = await rollupParentStatus(db, entityId, { projectKey });
        return {
          values: {
            updatedIds: result.updatedIds,
            derived: result.derived
          }
        };
      }

      throw new Error(`Unsupported write action: ${action}`);
    },
    resolveLlmJsonSchema: async (key: string) => {
      const row = (await db.llmJsonSchemas.getByKey(key, projectKey));
      if (!row) {
        return null;
      }
      return {
        key: row.key,
        schema: row.schema,
        version: row.version,
        id: row.id
      };
    },
    resolveSubworkflow: async (workflowId: string) => {
      const direct = await db.entities.get(workflowId);
      if (direct?.type === "flow") {
        return (await db.persist.getOrMigrateGraph({
          workflowId: direct.id,
          projectId: direct.projectId,
          metadata: direct.metadata as JsonRecord
        }));
      }
      const seeded = (await findSeededWorkflowPreset(db, workflowId, projectKey));
      if (!seeded) {
        return null;
      }
      const flow = await db.entities.get(seeded.id);
      if (!flow) {
        return null;
      }
      return (await db.persist.getOrMigrateGraph({
        workflowId: flow.id,
        projectId: flow.projectId,
        metadata: flow.metadata as JsonRecord
      }));
    }
  };
}

function mapRunStatus(result: WorkflowStepResult): WorkflowRunStatus {
  if (result.kind === "pending_llm") {
    return "pending_llm";
  }
  if (result.kind === "pending_user") {
    return "pending_user";
  }
  if (result.kind === "completed") {
    return "completed";
  }
  if (result.kind === "failed") {
    return "failed";
  }
  return "running";
}

function asBag(raw: JsonRecord): WorkflowContextBag {
  const parsed = parseContextBag(raw);
  if (!parsed) {
    throw new Error("Workflow run bag is not a valid context bag.");
  }
  return parsed;
}

export interface AdvanceWorkflowRunInput {
  runId: string;
  projectKey?: string;
  /** Complete a pending LLM node, then continue until the next pause. */
  llmWrites?: Record<string, unknown>;
  /** Complete a pending user gate with a route label. */
  userRoute?: string;
  maxSteps?: number;
  /** In-process runtime adapters, such as Assistant delegation. Never serialized in API payloads. */
  adapters?: Pick<WorkflowAdapters, "runAgent" | "resumeAgent">;
}

export interface AdvanceWorkflowRunResult {
  run: WorkflowRunRecord;
  step: WorkflowStepResult;
  nodeRuns: WorkflowNodeRun[];
}

/**
 * Advance a persisted workflow run with the core step runner until pause/complete/fail.
 */
export async function advanceWorkflowRun(
  db: Storage,
  input: AdvanceWorkflowRunInput
): Promise<AdvanceWorkflowRunResult> {
  const run = (await db.persist.getRun(input.runId));
  if (!run) {
    throw new Error(`Workflow run ${input.runId} not found.`);
  }

  const flow = await db.entities.get(run.workflowId);
  const projectKey =
    input.projectKey ??
    (flow ? (await db.projects.keyForId(flow.projectId)) ?? "PLAN" : "PLAN");

  const graph = run.definitionSnapshot;
  let bag = asBag(run.bag);
  bag = { ...bag, runId: run.id };

  const graphEntities = await db.entities.list({ projectKey });
  const graphRelations = await db.relations.list({ projectKey });
  const adapters: WorkflowAdapters = {
    ...createWorkflowAdapters(db, projectKey),
    ...(input.adapters ?? {})
  };

  let step: WorkflowStepResult;

  if (input.llmWrites || input.userRoute) {
    step = await stepWorkflow({
      graph,
      bag,
      adapters,
      entities: graphEntities,
      relations: graphRelations,
      llmWrites: input.llmWrites,
      userRoute: input.userRoute
    });
    bag = step.bag;
    if (step.kind === "advanced") {
      step = await runWorkflowUntilPause({
        graph,
        bag,
        adapters,
        entities: graphEntities,
        relations: graphRelations,
        maxSteps: input.maxSteps
      });
    }
  } else {
    step = await runWorkflowUntilPause({
      graph,
      bag,
      adapters,
      entities: graphEntities,
      relations: graphRelations,
      maxSteps: input.maxSteps
    });
  }

  const status = mapRunStatus(step);
  (await db.persist.updateRun({
    id: run.id,
    status,
    bag: step.bag as unknown as JsonRecord,
    error: step.kind === "failed" ? step.message ?? step.bag.error ?? "Workflow failed." : null,
    finished: status === "completed" || status === "failed"
  }));

  if (step.nodeId) {
    (await db.persist.recordNodeRun({
      runId: run.id,
      nodeId: step.nodeId,
      status:
        step.kind === "failed"
          ? "failed"
          : step.kind === "pending_llm" || step.kind === "pending_user"
            ? "waiting"
            : step.kind === "completed"
              ? "succeeded"
              : "running",
      input:
        step.kind === "pending_llm" && step.llm?.schemaKey
          ? {
              schemaKey: step.llm.schemaKey,
              schemaId: step.llm.jsonSchemaId ?? null,
              version: step.llm.jsonSchemaVersion ?? null,
              schema_json: step.llm.jsonSchema ?? null
            }
          : {},
      output: {
        kind: step.kind,
        message: step.message ?? null,
        llm: step.llm ?? null,
        keys: step.bag.keys
      },
      error: step.kind === "failed" ? { message: step.message ?? step.bag.error } : null
    }));
  }

  const updated = (await db.persist.getRun(run.id));
  if (!updated) {
    throw new Error(`Workflow run ${input.runId} missing after update.`);
  }

  return {
    run: updated,
    step,
    nodeRuns: (await db.persist.listNodeRuns(run.id))
  };
}

export interface ResolveWorkflowFlowInput {
  /** Flow entity id. */
  id?: string;
  /**
   * Stable lookup key: `metadata.presetKey` first, then entity `key`.
   * Example: `ensure_aspect`.
   */
  key?: string;
  projectKey?: string;
}

/** Resolve a flow by id or preset/entity key. */
export async function resolveWorkflowFlow(
  db: Storage,
  input: ResolveWorkflowFlowInput
): Promise<Entity> {
  const projectKey = input.projectKey ?? "PLAN";
  const id = input.id?.trim();
  const key = input.key?.trim();

  if (id) {
    const entity = await db.entities.get(id);
    if (!entity || entity.type !== "flow") {
      throw new Error(`Workflow flow not found for id '${id}'.`);
    }
    return entity;
  }

  if (!key) {
    throw new Error("Provide workflow id or key (presetKey / flow key).");
  }

  const byPreset = await db.catalog.findPreset(projectKey, key);

  if (byPreset) {
    const entity = await db.entities.get(byPreset.id);
    if (entity) {
      return entity;
    }
  }

  const byKey = (await db.entities.list({projectKey, type: "flow"})).find(entity => entity.key === key);

  if (byKey) {
    const entity = await db.entities.get(byKey.id);
    if (entity) {
      return entity;
    }
  }

  throw new Error(`Workflow flow not found for key '${key}'.`);
}

export interface RunWorkflowInput extends ResolveWorkflowFlowInput {
  goal?: string;
  bag?: Record<string, unknown>;
  /** Resume an existing run (id/key optional when runId is set). */
  runId?: string;
  llmWrites?: Record<string, unknown>;
  userRoute?: string;
  maxSteps?: number;
  actor?: WorkflowContextBag["actor"];
  /** In-process runtime adapters, such as Assistant delegation. Never serialized in API payloads. */
  adapters?: Pick<WorkflowAdapters, "runAgent" | "resumeAgent">;
}

export interface RunWorkflowResult extends AdvanceWorkflowRunResult {
  flow: Entity;
}

function pauseNote(step: WorkflowStepResult): string | undefined {
  if (step.kind === "pending_llm") {
    return "Paused for LLM. POST /api/workflows/run with { runId, llmWrites } to continue.";
  }
  if (step.kind === "pending_user") {
    return "Paused for user. POST /api/workflows/run with { runId, userRoute } to continue.";
  }
  return undefined;
}

/**
 * Start or resume a workflow by flow id / preset key.
 * - New run: pass id or key (+ optional goal/bag)
 * - Resume: pass runId (+ llmWrites or userRoute)
 */
export async function runWorkflow(
  db: Storage,
  input: RunWorkflowInput
): Promise<RunWorkflowResult & { note?: string }> {
  if (input.runId) {
    const existing = (await db.persist.getRun(input.runId));
    if (!existing) {
      throw new Error(`Workflow run ${input.runId} not found.`);
    }
    if (input.id || input.key) {
      const flow = await resolveWorkflowFlow(db, input);
      if (existing.workflowId !== flow.id) {
        throw new Error("runId does not belong to the resolved workflow.");
      }
    }
    const flow = await db.entities.get(existing.workflowId);
    if (!flow || flow.type !== "flow") {
      throw new Error("Workflow flow missing for run.");
    }
    if (!input.llmWrites && !input.userRoute) {
      return {
        flow,
        run: existing,
        step: {
          kind:
            existing.status === "pending_llm"
              ? "pending_llm"
              : existing.status === "pending_user"
                ? "pending_user"
                : existing.status === "completed"
                  ? "completed"
                  : existing.status === "failed"
                    ? "failed"
                    : "advanced",
          bag: asBag(existing.bag),
          nodeId: typeof (existing.bag as { cursor?: unknown }).cursor === "string"
            ? ((existing.bag as { cursor: string }).cursor)
            : null
        },
        nodeRuns: (await db.persist.listNodeRuns(existing.id)),
        note: pauseNote({
          kind: existing.status === "pending_llm" ? "pending_llm" : existing.status === "pending_user" ? "pending_user" : "advanced",
          bag: asBag(existing.bag),
          nodeId: null
        })
      };
    }
    const advanced = await advanceWorkflowRun(db, {
      runId: input.runId,
      projectKey: input.projectKey,
      llmWrites: input.llmWrites,
      userRoute: input.userRoute,
      maxSteps: input.maxSteps,
      adapters: input.adapters
    });
    return { flow, ...advanced, note: pauseNote(advanced.step) };
  }

  const flow = await resolveWorkflowFlow(db, input);
  const graph =
    (await db.persist.getOrMigrateGraph({
      workflowId: flow.id,
      projectId: flow.projectId,
      metadata: flow.metadata as JsonRecord
    })) ?? null;
  if (!graph) {
    throw new Error("Workflow graph missing.");
  }
  const start = findStartNode(graph);
  if (!start) {
    throw new Error("Workflow requires a start node.");
  }

  const goal = input.goal?.trim() || flow.title;
  const bag = createContextBag({
    workflowId: flow.id,
    goal,
    startNodeId: start.id,
    keys: input.bag,
    actor: input.actor
  });
  const run = (await db.persist.createRun({
    workflowId: flow.id,
    projectId: flow.projectId,
    graph,
    bag: bag as unknown as JsonRecord
  }));
  const advanced = await advanceWorkflowRun(db, {
    runId: run.id,
    projectKey: input.projectKey,
    maxSteps: input.maxSteps,
    adapters: input.adapters
  });
  return { flow, ...advanced, note: pauseNote(advanced.step) };
}

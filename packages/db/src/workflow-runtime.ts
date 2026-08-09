import {
  createContextBag,
  findStartNode,
  parseContextBag,
  runWorkflowUntilPause,
  stepWorkflow,
  type Entity,
  type EntityStatus,
  type EntityType,
  type JsonRecord,
  type WorkflowAdapters,
  type WorkflowContextBag,
  type WorkflowStepResult
} from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { createEntity, getEntity, listEntities, listRelations, updateEntity } from "./repository";
import { rollupParentStatus } from "./rollup";
import {
  createWorkflowRun,
  getOrMigrateWorkflowGraph,
  getWorkflowRun,
  listWorkflowNodeRuns,
  recordWorkflowNodeRun,
  updateWorkflowRun,
  type WorkflowNodeRun,
  type WorkflowRun,
  type WorkflowRunStatus
} from "./workflows";

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

/** Build runtime adapters that read/write the living SQLite graph. */
export function createSqliteWorkflowAdapters(
  db: DatabaseSync,
  projectKey = "PLAN"
): WorkflowAdapters {
  return {
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
        const resultKey = writeResultKey(args, "aspectId");

        const created = await createEntity(db, {
          projectKey,
          type: asEntityType(args.type, "aspect"),
          title,
          summary: typeof args.summary === "string" ? args.summary : "",
          key: typeof args.key === "string" ? args.key : null,
          status: asStatus(args.status, "planned"),
          metadata: {
            narrative: {
              reason,
              updatedAt: new Date().toISOString(),
              updatedBy: "workflow"
            }
          },
          relations: parentAspectId
            ? [{ targetEntityId: parentAspectId, type: "supports" as const }]
            : undefined
        });

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
        const patch: Parameters<typeof updateEntity>[1]["patch"] = {};
        if (typeof args.title === "string") {
          patch.title = args.title;
        }
        if (typeof args.summary === "string") {
          patch.summary = args.summary;
        }
        if (typeof args.status === "string") {
          patch.status = asStatus(args.status, "planned");
        }
        const current = await getEntity(db, id);
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
        const updated = await updateEntity(db, { id, patch });
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
}

export interface AdvanceWorkflowRunResult {
  run: WorkflowRun;
  step: WorkflowStepResult;
  nodeRuns: WorkflowNodeRun[];
}

/**
 * Advance a persisted workflow run with the core step runner until pause/complete/fail.
 */
export async function advanceWorkflowRun(
  db: DatabaseSync,
  input: AdvanceWorkflowRunInput
): Promise<AdvanceWorkflowRunResult> {
  const run = getWorkflowRun(db, input.runId);
  if (!run) {
    throw new Error(`Workflow run ${input.runId} not found.`);
  }

  const flow = await getEntity(db, run.workflowId);
  const projectKey =
    input.projectKey ??
    (flow
      ? ((
          db
            .prepare(`SELECT key FROM projects WHERE id = ?`)
            .get(flow.projectId) as { key: string } | undefined
        )?.key ?? "PLAN")
      : "PLAN");

  const graph = run.definitionSnapshot;
  let bag = asBag(run.bag);
  bag = { ...bag, runId: run.id };

  const entities = await listEntities(db, { projectKey });
  const relations = await listRelations(db, { projectKey });
  const adapters = createSqliteWorkflowAdapters(db, projectKey);

  let step: WorkflowStepResult;

  if (input.llmWrites || input.userRoute) {
    step = await stepWorkflow({
      graph,
      bag,
      adapters,
      entities,
      relations,
      llmWrites: input.llmWrites,
      userRoute: input.userRoute
    });
    bag = step.bag;
    if (step.kind === "advanced") {
      step = await runWorkflowUntilPause({
        graph,
        bag,
        adapters,
        entities,
        relations,
        maxSteps: input.maxSteps
      });
    }
  } else {
    step = await runWorkflowUntilPause({
      graph,
      bag,
      adapters,
      entities,
      relations,
      maxSteps: input.maxSteps
    });
  }

  const status = mapRunStatus(step);
  updateWorkflowRun(db, {
    id: run.id,
    status,
    bag: step.bag as unknown as JsonRecord,
    error: step.kind === "failed" ? step.message ?? step.bag.error ?? "Workflow failed." : null,
    finished: status === "completed" || status === "failed"
  });

  if (step.nodeId) {
    recordWorkflowNodeRun(db, {
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
      input: {},
      output: {
        kind: step.kind,
        message: step.message ?? null,
        llm: step.llm ?? null,
        keys: step.bag.keys
      },
      error: step.kind === "failed" ? { message: step.message ?? step.bag.error } : null
    });
  }

  const updated = getWorkflowRun(db, run.id);
  if (!updated) {
    throw new Error(`Workflow run ${input.runId} missing after update.`);
  }

  return {
    run: updated,
    step,
    nodeRuns: listWorkflowNodeRuns(db, run.id)
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
  db: DatabaseSync,
  input: ResolveWorkflowFlowInput
): Promise<Entity> {
  const projectKey = input.projectKey ?? "PLAN";
  const id = input.id?.trim();
  const key = input.key?.trim();

  if (id) {
    const entity = await getEntity(db, id);
    if (!entity || entity.type !== "flow") {
      throw new Error(`Workflow flow not found for id '${id}'.`);
    }
    return entity;
  }

  if (!key) {
    throw new Error("Provide workflow id or key (presetKey / flow key).");
  }

  const byPreset = db
    .prepare(
      `SELECT entities.id
       FROM entities
       INNER JOIN projects ON projects.id = entities.project_id
       WHERE projects.key = ?
         AND entities.type = 'flow'
         AND json_extract(entities.metadata_json, '$.presetKey') = ?
       LIMIT 1`
    )
    .get(projectKey, key) as { id: string } | undefined;

  if (byPreset) {
    const entity = await getEntity(db, byPreset.id);
    if (entity) {
      return entity;
    }
  }

  const byKey = db
    .prepare(
      `SELECT entities.id
       FROM entities
       INNER JOIN projects ON projects.id = entities.project_id
       WHERE projects.key = ?
         AND entities.type = 'flow'
         AND entities.key = ?
       LIMIT 1`
    )
    .get(projectKey, key) as { id: string } | undefined;

  if (byKey) {
    const entity = await getEntity(db, byKey.id);
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
  db: DatabaseSync,
  input: RunWorkflowInput
): Promise<RunWorkflowResult & { note?: string }> {
  if (input.runId) {
    const existing = getWorkflowRun(db, input.runId);
    if (!existing) {
      throw new Error(`Workflow run ${input.runId} not found.`);
    }
    if (input.id || input.key) {
      const flow = await resolveWorkflowFlow(db, input);
      if (existing.workflowId !== flow.id) {
        throw new Error("runId does not belong to the resolved workflow.");
      }
    }
    const flow = await getEntity(db, existing.workflowId);
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
        nodeRuns: listWorkflowNodeRuns(db, existing.id),
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
      maxSteps: input.maxSteps
    });
    return { flow, ...advanced, note: pauseNote(advanced.step) };
  }

  const flow = await resolveWorkflowFlow(db, input);
  const graph =
    getOrMigrateWorkflowGraph(db, {
      workflowId: flow.id,
      projectId: flow.projectId,
      metadata: flow.metadata as JsonRecord
    }) ?? null;
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
    keys: input.bag
  });
  const run = createWorkflowRun(db, {
    workflowId: flow.id,
    projectId: flow.projectId,
    graph,
    bag: bag as unknown as JsonRecord
  });
  const advanced = await advanceWorkflowRun(db, {
    runId: run.id,
    projectKey: input.projectKey,
    maxSteps: input.maxSteps
  });
  return { flow, ...advanced, note: pauseNote(advanced.step) };
}

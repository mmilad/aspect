import {
  composeTaskPrompt,
  asEntityList,
  asRelationList,
  matchesWhere,
  neighborhoodContext,
  projectKeys,
  rankTaskCandidates,
  selectedEntityId,
  type RankedTaskCandidate
} from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";
import {
  applyPlanClassify,
  applyPlanDecide,
  applyPlanExpand,
  haltPlanDocument,
  pickPlanFrontier,
  planDocumentPersistRoute,
  planDocumentTitle,
  PLAN_DOCUMENT_PERSIST_REASON,
  prepareThinkingInputs,
  seedRootPlan
} from "../../plan-v1-apply";
import type { PlanBrief, PlanBudget, PlanDocument } from "../../plan-v1";
import { validatePlanClassify, validatePlanExpand } from "../../plan-v1-writes";

async function runFilter(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const filter = ctx.node.data.auto?.filter;
  if (!filter) {
    return ctx.fail(`Filter node ${ctx.node.id} requires auto.filter.`);
  }
  const writes = ctx.getWrites();

  if (filter.rank === "task_candidates") {
    // Prefer full runtime entities (bag may only hold compact projections).
    const candidates = rankTaskCandidates(ctx.entities, ctx.relations, {
      criticalTaggedIds: ctx.adapters.criticalTaggedIds
    });
    const projected = filter.keys
      ? candidates.map((item) => projectKeys(item, filter.keys) as RankedTaskCandidate)
      : candidates;
    const values: Record<string, unknown> = {};
    if (writes.includes("candidates")) {
      values.candidates = projected;
    } else {
      values[writes[0] ?? "candidates"] = projected;
    }
    if (writes.includes("hasCandidates")) {
      values.hasCandidates = projected.length > 0;
    }
    const applied = ctx.applyWrites(values);
    if (!applied.ok) {
      return ctx.fail(applied.error);
    }
    return ctx.advance();
  }

  const source = ctx.read(filter.from);
  if (!Array.isArray(source)) {
    return ctx.fail(`Filter node ${ctx.node.id} source '${filter.from}' is not an array.`);
  }
  const filtered = source
    .filter((item) => matchesWhere(item, filter.where))
    .map((item) => projectKeys(item, filter.keys));
  const applied = ctx.applyWrites({ [writes[0] ?? "filtered"]: filtered });
  if (!applied.ok) {
    return ctx.fail(applied.error);
  }
  return ctx.advance();
}

async function runAssign(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const assign = ctx.node.data.auto?.assign;
  if (!assign) {
    return ctx.fail(`Assign requires auto.assign on node ${ctx.node.id}.`);
  }
  const writes = ctx.getWrites();
  const values: Record<string, unknown> = { ...(assign.set ?? {}) };

  if (assign.pickFirst) {
    const source = ctx.read(assign.pickFirst.from);
    if (!Array.isArray(source) || source.length === 0) {
      return ctx.fail(`pickFirst source '${assign.pickFirst.from}' is empty.`);
    }
    const targetKey = writes.find((key) => !(key in values)) ?? writes[0] ?? "selected";
    values[targetKey] = source[0];
  }

  if (assign.neighborhoodOf) {
    const selectedId = selectedEntityId(ctx.read(assign.neighborhoodOf.of));
    if (!selectedId) {
      return ctx.fail(`neighborhoodOf.of '${assign.neighborhoodOf.of}' has no id.`);
    }
    const entityList = asEntityList(
      ctx.read(assign.neighborhoodOf.entitiesFrom ?? "entities"),
      ctx.entities
    );
    const relationList = asRelationList(
      ctx.read(assign.neighborhoodOf.relationsFrom ?? "relations"),
      ctx.relations
    );
    const targetKey = writes.find((key) => !(key in values)) ?? writes[0] ?? "taskContext";
    values[targetKey] = neighborhoodContext(selectedId, entityList, relationList);
  }

  if (assign.composeTaskPrompt) {
    const task = ctx.read(assign.composeTaskPrompt.taskFrom);
    const context = ctx.read(assign.composeTaskPrompt.contextFrom);
    if (!task || typeof task !== "object") {
      return ctx.fail(
        `composeTaskPrompt.taskFrom '${assign.composeTaskPrompt.taskFrom}' missing.`
      );
    }
    const targetKey = writes.find((key) => !(key in values)) ?? writes[0] ?? "agentPrompt";
    values[targetKey] = composeTaskPrompt({
      task: task as RankedTaskCandidate,
      context: context ?? {}
    });
  }

  if (assign.plan) {
    const planResult = runPlanAssign(ctx, assign.plan.op);
    if (!planResult.ok) {
      if (assign.plan.op === "applyClassify" || assign.plan.op === "applyExpand") {
        const retry = applyRetryValues(ctx.read("plan") as PlanDocument, asFrontierId(ctx), planResult.error);
        for (const key of writes) {
          if (key in retry) {
            values[key] = retry[key];
          }
        }
      } else {
        return ctx.fail(planResult.error);
      }
    } else {
      for (const key of writes) {
        if (key in planResult.values) {
          values[key] = planResult.values[key];
        }
      }
    }
  }

  if (
    !assign.set &&
    !assign.pickFirst &&
    !assign.neighborhoodOf &&
    !assign.composeTaskPrompt &&
    !assign.plan
  ) {
    return ctx.fail(
      `Assign requires auto.assign.set (or pickFirst/neighborhoodOf/composeTaskPrompt/plan) on node ${ctx.node.id}.`
    );
  }

  const applied = ctx.applyWrites(values);
  if (!applied.ok) {
    return ctx.fail(applied.error);
  }
  return ctx.advance();
}

export async function executeTransform(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const assignOnly =
    Boolean(ctx.node.data.auto?.assign) &&
    !ctx.node.data.auto?.loadContext &&
    !ctx.node.data.auto?.filter;

  if (assignOnly) {
    return runAssign(ctx);
  }
  return runFilter(ctx);
}

function asBrief(ctx: NodeExecuteContext): PlanBrief {
  const task = ctx.read("task");
  const success = ctx.read("success");
  const constraints = ctx.read("constraints");
  const context = ctx.read("context");
  return {
    task: typeof task === "string" && task.trim() ? task.trim() : "Untitled goal",
    success: typeof success === "string" && success.trim() ? success.trim() : "A inspectable plan.v1 document.",
    constraints: Array.isArray(constraints)
      ? constraints.filter((item): item is string => typeof item === "string")
      : [],
    context: context && typeof context === "object" && !Array.isArray(context) ? (context as Record<string, unknown>) : {}
  };
}

function asFrontierId(ctx: NodeExecuteContext): string {
  const frontierId = ctx.read("frontierId");
  return typeof frontierId === "string" ? frontierId : "";
}

function applyRetryValues(
  plan: PlanDocument,
  frontierId: string,
  error: string
): Record<string, unknown> {
  return { plan, route: "retry", applyError: error, frontierId };
}

function asBudget(raw: unknown): Partial<PlanBudget> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const budget: Partial<PlanBudget> = {};
  if (typeof record.maxDepth === "number") {
    budget.maxDepth = record.maxDepth;
  }
  if (typeof record.maxNodes === "number") {
    budget.maxNodes = record.maxNodes;
  }
  if (typeof record.maxLlmTurns === "number") {
    budget.maxLlmTurns = record.maxLlmTurns;
  }
  return budget;
}

function runPlanAssign(
  ctx: NodeExecuteContext,
  op: "seed" | "pickFrontier" | "applyClassify" | "applyExpand" | "prepareThink" | "applyDecide" | "halt"
): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  if (op === "seed") {
    const plan = seedRootPlan(asBrief(ctx), asBudget(ctx.read("budget")));
    return { ok: true, values: { plan } };
  }
  const current = ctx.read("plan") as PlanDocument | undefined;
  if (!current || typeof current !== "object") {
    return { ok: false, error: "plan assign requires bag.plan." };
  }
  if (op === "pickFrontier") {
    const frontierId = pickPlanFrontier(current);
    return {
      ok: true,
      values: {
        plan: current,
        frontierId: frontierId ?? "",
        route: frontierId ? "classify" : "halt",
        applyError: ""
      }
    };
  }
  if (op === "applyClassify") {
    const frontierId = asFrontierId(ctx);
    const parsed = validatePlanClassify(ctx.read("classify"));
    if (!parsed.ok) {
      return { ok: true, values: applyRetryValues(current, frontierId, parsed.errors.join("; ")) };
    }
    const applied = applyPlanClassify(current, parsed.write, frontierId);
    if (!applied.ok) {
      return { ok: true, values: applyRetryValues(current, frontierId, applied.error) };
    }
    return {
      ok: true,
      values: {
        plan: applied.plan,
        route: parsed.write.status,
        frontierId,
        applyError: ""
      }
    };
  }
  if (op === "applyExpand") {
    const frontierId = asFrontierId(ctx);
    const parsed = validatePlanExpand(ctx.read("expand"));
    if (!parsed.ok) {
      return { ok: true, values: applyRetryValues(current, frontierId, parsed.errors.join("; ")) };
    }
    const applied = applyPlanExpand(current, parsed.write, frontierId);
    if (!applied.ok) {
      return { ok: true, values: applyRetryValues(current, frontierId, applied.error) };
    }
    return { ok: true, values: { plan: applied.plan, route: "ok", applyError: "", frontierId } };
  }
  if (op === "prepareThink") {
    const frontierId = asFrontierId(ctx);
    return prepareThinkingInputs(current, frontierId);
  }
  if (op === "applyDecide") {
    const frontierId = asFrontierId(ctx);
    const applied = applyPlanDecide(current, { nodeId: frontierId, thought: ctx.read("thoughtDecision") });
    if (!applied.ok) {
      return applied;
    }
    return { ok: true, values: { plan: applied.plan } };
  }
  const halted = haltPlanDocument(current);
  return {
    ok: true,
    values: {
      plan: halted.plan,
      stop: halted.stop,
      persistRoute: planDocumentPersistRoute(ctx.read("targetTaskId")),
      planTitle: planDocumentTitle(halted.plan),
      planSummary: halted.stop.message,
      planReason: PLAN_DOCUMENT_PERSIST_REASON
    }
  };
}

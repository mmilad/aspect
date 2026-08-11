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

  if (!assign.set && !assign.pickFirst && !assign.neighborhoodOf && !assign.composeTaskPrompt) {
    return ctx.fail(
      `Assign requires auto.assign.set (or pickFirst/neighborhoodOf/composeTaskPrompt) on node ${ctx.node.id}.`
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

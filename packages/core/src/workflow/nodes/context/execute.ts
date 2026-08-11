import {
  compactEntity,
  compactRelation,
  composeTaskPrompt,
  defaultLoadContext,
  loadAllEntities,
  asEntityList,
  asRelationList,
  neighborhoodContext,
  selectedEntityId,
  type RankedTaskCandidate
} from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

async function runContextLoad(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const load = ctx.node.data.auto?.loadContext;
  if (!load) {
    return ctx.fail(`Context node ${ctx.node.id} requires auto.loadContext.`);
  }

  const mode = load.mode ?? "query";
  const writes = ctx.getWrites();
  const values: Record<string, unknown> = {};

  if (mode === "all") {
    const matches = ctx.adapters.loadContext
      ? await ctx.adapters.loadContext({
          query: "",
          types: load.types,
          limit: load.limit ?? Number.MAX_SAFE_INTEGER,
          mode: "all"
        })
      : loadAllEntities(ctx.entities, load.types, load.limit);
    const entityWrite = writes.find((key) => key !== "relations") ?? writes[0] ?? "entities";
    values[entityWrite] = matches.map((item) => {
      const full = ctx.entities.find((entity) => entity.id === item.id);
      return full ? compactEntity(full) : item;
    });
    if (writes.includes("relations")) {
      values.relations = ctx.relations.map(compactRelation);
    }
  } else {
    if (!load.queryFrom) {
      return ctx.fail(
        `Context node ${ctx.node.id} requires auto.loadContext.queryFrom when mode is query.`
      );
    }
    const queryValue = ctx.read(load.queryFrom);
    if (typeof queryValue !== "string") {
      return ctx.fail(`Context node ${ctx.node.id} queryFrom '${load.queryFrom}' is not a string.`);
    }
    const limit = load.limit ?? 10;
    const matches = ctx.adapters.loadContext
      ? await ctx.adapters.loadContext({
          query: queryValue,
          types: load.types,
          limit,
          mode: "query"
        })
      : defaultLoadContext(ctx.entities, { query: queryValue, types: load.types, limit });
    values[writes[0] ?? "matches"] = matches;
  }

  const applied = ctx.applyWrites(values);
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

export async function executeContext(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const assignOnly =
    Boolean(ctx.node.data.auto?.assign) &&
    !ctx.node.data.auto?.loadContext &&
    !ctx.node.data.auto?.filter;

  if (assignOnly) {
    return runAssign(ctx);
  }
  return runContextLoad(ctx);
}

import type { Entity } from "../../../domain";
import type { EntityFieldName, EntityFilter } from "../../../domain/query";
import { compileListQuery, evaluatePlan } from "../../../domain/query";
import { expandTaskListQuery } from "../../../domain/api/controllers";
import { compactEntity, rankTaskCandidates } from "../../../domain/task-candidacy";
import { entitySearchValues, rankedByQuery } from "../../../domain/search";
import { asEntityList, asRelationList, defaultLoadContext, resolveWriteResult } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";
import type { WorkflowQueryConfig, WorkflowQuerySlot, WorkflowQuerySlotKind } from "../_shared/types";
import { effectiveSlots } from "./catalog";
import { walkNeighborhood } from "./neighborhood";
import { hasSlotValue } from "./slots";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function relatedToFilter(relatedTo: string, slot?: WorkflowQuerySlot): EntityFilter {
  return {
    rel: {
      direction: slot?.rel?.direction ?? "out",
      types: slot?.rel?.types,
      some: { field: "id", op: "eq", value: relatedTo }
    }
  };
}

function coerceInValue(value: unknown): string | string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string" && value.includes(",")) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(value);
}

function resolveSlotValue(ctx: NodeExecuteContext, slot: WorkflowQuerySlot): unknown {
  if (slot.source === "const") {
    return slot.value;
  }
  const wired = ctx.read(slot.id);
  if (slot.slot === "from" || slot.slot === "relations") {
    return wired !== undefined ? wired : slot.value;
  }
  if (typeof wired === "string") {
    return wired.trim() ? wired.trim() : slot.value;
  }
  if (wired !== undefined && wired !== null) {
    return wired;
  }
  return slot.value;
}

function findSlot(slots: WorkflowQuerySlot[], kind: WorkflowQuerySlotKind): WorkflowQuerySlot | undefined {
  return slots.find((slot) => slot.slot === kind);
}

function slotToFilter(slot: WorkflowQuerySlot, value: unknown): EntityFilter | undefined {
  if (slot.slot === "q") {
    const q = optionalString(value);
    return q ? { field: "q", op: "match", value: q } : undefined;
  }
  if (slot.slot === "relatedTo") {
    const relatedTo = optionalString(value);
    return relatedTo ? relatedToFilter(relatedTo, slot) : undefined;
  }
  if (slot.slot === "rel") {
    const relatedTo = optionalString(value);
    if (!relatedTo) {
      return undefined;
    }
    return {
      rel: {
        direction: slot.rel?.direction ?? "out",
        types: slot.rel?.types,
        some: { field: "id", op: "eq", value: relatedTo }
      }
    };
  }
  if (slot.slot === "field") {
    const field = slot.field as EntityFieldName | undefined;
    if (!field) {
      return undefined;
    }
    const op = slot.op ?? "eq";
    if (op === "match") {
      const q = optionalString(value);
      return q ? { field: "q", op: "match", value: q } : undefined;
    }
    if (!hasSlotValue(value)) {
      return undefined;
    }
    if (op === "in") {
      return { field, op: "in", value: coerceInValue(value) };
    }
    if (op === "neq") {
      return { field, op: "neq", value: String(value) };
    }
    return { field, op: "eq", value: String(value) };
  }
  return undefined;
}

const FILTER_SLOT_KINDS = new Set<WorkflowQuerySlotKind>(["q", "relatedTo", "field", "rel"]);

function collectFilterParts(
  ctx: NodeExecuteContext,
  query: WorkflowQueryConfig,
  slots: WorkflowQuerySlot[]
): EntityFilter[] {
  const parts: EntityFilter[] = [];
  if (query.where) {
    parts.push(query.where);
  }
  for (const slot of slots) {
    if (!FILTER_SLOT_KINDS.has(slot.slot)) {
      continue;
    }
    const value = resolveSlotValue(ctx, slot);
    if (!hasSlotValue(value)) {
      continue;
    }
    const filter = slotToFilter(slot, value);
    if (filter) {
      parts.push(filter);
    }
  }
  return parts;
}

function projectEntities(entities: Entity[], select: "compact" | "full"): unknown[] {
  return select === "full" ? entities : entities.map(compactEntity);
}

async function listFromStoreOrMemory(
  ctx: NodeExecuteContext,
  query: WorkflowQueryConfig,
  where: EntityFilter | undefined
): Promise<Entity[]> {
  const listQuery = {
    where,
    limit: query.limit,
    includeArchived: query.includeArchived,
    select: query.select ?? "compact"
  };
  const type = query.type;
  if (ctx.adapters.listEntities) {
    return ctx.adapters.listEntities(listQuery, type ? { type } : undefined);
  }
  return evaluatePlan(compileListQuery(listQuery, type ? { type } : undefined), ctx.entities, ctx.relations);
}

function resolveId(ctx: NodeExecuteContext, slots: WorkflowQuerySlot[]): string | undefined {
  const slot = findSlot(slots, "id");
  return optionalString(slot ? resolveSlotValue(ctx, slot) : ctx.read("id"));
}

async function executeGet(ctx: NodeExecuteContext, query: WorkflowQueryConfig): Promise<WorkflowStepResult> {
  const id = resolveId(ctx, effectiveSlots(query));
  if (!id) {
    return ctx.fail(`Query ${ctx.node.id}: id must be a non-empty string.`);
  }
  let entity: Entity | null = ctx.adapters.getEntity
    ? ((await ctx.adapters.getEntity(id)) ?? null)
    : (ctx.entities.find((item) => item.id === id) ?? null);
  if (entity && query.includeArchived !== true && entity.status === "archived") {
    entity = null;
  }
  if (entity && query.type && entity.type !== query.type) {
    entity = null;
  }
  const projected = entity ? (query.select === "full" ? entity : compactEntity(entity)) : null;
  const applied = ctx.applyWrites({ entity: projected });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeList(ctx: NodeExecuteContext, query: WorkflowQueryConfig): Promise<WorkflowStepResult> {
  const slots = effectiveSlots(query);
  const rows = await listFromStoreOrMemory(ctx, query, andWhere(collectFilterParts(ctx, query, slots)));
  const applied = ctx.applyWrites({ entities: projectEntities(rows, query.select ?? "compact") });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeSearch(ctx: NodeExecuteContext, query: WorkflowQueryConfig): Promise<WorkflowStepResult> {
  const slots = effectiveSlots(query);
  const qSlot = findSlot(slots, "q");
  const q = optionalString(qSlot ? resolveSlotValue(ctx, qSlot) : ctx.read("q"));
  if (q === undefined) {
    return ctx.fail(`Query ${ctx.node.id}: q must be a non-empty string.`);
  }
  const relatedSlot = findSlot(slots, "relatedTo");
  const relatedTo = optionalString(relatedSlot ? resolveSlotValue(ctx, relatedSlot) : ctx.read("relatedTo"));
  const types = query.type ? [query.type] : undefined;
  const limit = query.limit ?? 10;
  const extraFilters = slots.some((slot) => slot.slot === "field" || slot.slot === "rel");
  if (!extraFilters && ctx.adapters.searchEntities) {
    const matches = await ctx.adapters.searchEntities({
      q,
      types,
      relatedTo,
      limit,
      includeArchived: query.includeArchived,
      select: query.select
    });
    const applied = ctx.applyWrites({ matches });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }
  if (!extraFilters && ctx.adapters.loadContext) {
    const matches = await ctx.adapters.loadContext({
      query: q,
      types,
      limit,
      mode: "query"
    });
    const applied = ctx.applyWrites({ matches });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }
  if (extraFilters) {
    const rows = await listFromStoreOrMemory(ctx, query, andWhere(collectFilterParts(ctx, query, slots)));
    const ranked = rankedByQuery(rows, q, entitySearchValues).slice(0, limit);
    const matches = ranked.map(({ item, score }) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      status: item.status,
      summary: item.summary,
      score
    }));
    const applied = ctx.applyWrites({ matches });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }
  const matches = defaultLoadContext(ctx.entities, { query: q, types, limit });
  const applied = ctx.applyWrites({ matches });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeNextWork(ctx: NodeExecuteContext, query: WorkflowQueryConfig): Promise<WorkflowStepResult> {
  const slots = effectiveSlots(query);
  const relatedSlot = findSlot(slots, "relatedTo");
  const relatedTo = optionalString(relatedSlot ? resolveSlotValue(ctx, relatedSlot) : ctx.read("relatedTo"));
  const limit = query.limit;
  const extraFilters = slots.some((slot) => slot.slot === "field" || slot.slot === "rel");
  if (!extraFilters && ctx.adapters.nextWork) {
    const tasks = await ctx.adapters.nextWork({
      relatedTo,
      limit,
      includeArchived: query.includeArchived,
      select: query.select
    });
    const applied = ctx.applyWrites({ tasks });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }
  const extraWhere = collectFilterParts(
    ctx,
    query,
    slots.filter((slot) => slot.slot === "field" || slot.slot === "rel")
  );
  const listQuery = expandTaskListQuery({
    relatedTo: relatedTo ? { id: relatedTo } : undefined,
    where: andWhere([...extraWhere, { pred: "task_candidate" }]),
    includeArchived: query.includeArchived,
    select: "full"
  });
  const pool = ctx.adapters.listEntities
    ? await ctx.adapters.listEntities(listQuery, { type: "task" })
    : evaluatePlan(compileListQuery(listQuery, { type: "task" }), ctx.entities, ctx.relations);
  const ranked = rankTaskCandidates(pool, ctx.relations, {
    criticalTaggedIds: ctx.adapters.criticalTaggedIds
  });
  const tasks = typeof limit === "number" ? ranked.slice(0, limit) : ranked;
  const applied = ctx.applyWrites({ tasks });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeNeighborhood(
  ctx: NodeExecuteContext,
  query: WorkflowQueryConfig
): Promise<WorkflowStepResult> {
  const id = resolveId(ctx, effectiveSlots(query));
  if (!id) {
    return ctx.fail(`Query ${ctx.node.id}: id must be a non-empty string.`);
  }
  const depth = query.depth ?? 1;
  const select = query.select ?? "compact";
  if (ctx.adapters.neighborhood) {
    const result = await ctx.adapters.neighborhood({
      id,
      depth,
      select,
      includeArchived: query.includeArchived
    });
    const applied = ctx.applyWrites({ entities: result.entities, relations: result.relations });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  }
  const result = walkNeighborhood(id, depth, ctx.entities, ctx.relations, select);
  const applied = ctx.applyWrites(result);
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeFilter(ctx: NodeExecuteContext, query: WorkflowQueryConfig): Promise<WorkflowStepResult> {
  const slots = effectiveSlots(query);
  const fromSlot = findSlot(slots, "from");
  const fromValue = fromSlot ? resolveSlotValue(ctx, fromSlot) : ctx.read("from");
  if (!Array.isArray(fromValue)) {
    return ctx.fail(`Query ${ctx.node.id}: from must be an entity array.`);
  }
  const from = asEntityList(fromValue, []);
  const relationsSlot = findSlot(slots, "relations");
  const relationsValue = relationsSlot ? resolveSlotValue(ctx, relationsSlot) : ctx.read("relations");
  const relations = asRelationList(relationsValue, ctx.relations);
  const listQuery = {
    where: andWhere(collectFilterParts(ctx, query, slots)),
    includeArchived: query.includeArchived ?? true,
    select: query.select ?? "compact"
  };
  const rows = evaluatePlan(
    compileListQuery(listQuery, query.type ? { type: query.type } : undefined),
    from,
    relations
  );
  const applied = ctx.applyWrites({ entities: projectEntities(rows, query.select ?? "compact") });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

function optionalArg(args: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    args[key] = value;
  }
}

async function executeCreate(ctx: NodeExecuteContext, query: WorkflowQueryConfig): Promise<WorkflowStepResult> {
  const title = optionalString(ctx.read("title"));
  const reason = optionalString(ctx.read("reason"));
  if (!title) {
    return ctx.fail(`Query ${ctx.node.id}: title must be a non-empty string.`);
  }
  if (!reason) {
    return ctx.fail(`Query ${ctx.node.id}: reason must be a non-empty string.`);
  }
  const args: Record<string, unknown> = {
    title,
    reason,
    type: query.type ?? "aspect",
    resultAs: "entityId"
  };
  optionalArg(args, "summary", ctx.read("summary"));
  optionalArg(args, "key", ctx.read("key"));
  optionalArg(args, "parentAspectId", ctx.read("parentAspectId"));
  optionalArg(args, "linkFrom", ctx.read("linkFrom"));
  optionalArg(args, "document", ctx.read("document"));
  const priority = optionalString(ctx.read("priority"));
  if (query.type === "task" && priority) {
    args.metadata = { priority };
  }
  const result = await resolveWriteResult(ctx.adapters, "create_entity", args);
  if ("error" in result) {
    return ctx.fail(result.error);
  }
  const applied = ctx.applyWrites({ entityId: result.values.entityId ?? Object.values(result.values)[0] });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeUpdate(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const id = optionalString(ctx.read("id"));
  const reason = optionalString(ctx.read("reason"));
  if (!id) {
    return ctx.fail(`Query ${ctx.node.id}: id must be a non-empty string.`);
  }
  if (!reason) {
    return ctx.fail(`Query ${ctx.node.id}: reason must be a non-empty string.`);
  }
  const args: Record<string, unknown> = { id, reason, resultAs: "entityId" };
  optionalArg(args, "title", ctx.read("title"));
  optionalArg(args, "summary", ctx.read("summary"));
  optionalArg(args, "status", ctx.read("status"));
  const result = await resolveWriteResult(ctx.adapters, "update_entity", args);
  if ("error" in result) {
    return ctx.fail(result.error);
  }
  const applied = ctx.applyWrites({ entityId: result.values.entityId ?? Object.values(result.values)[0] });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

async function executeRollup(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const entityId = optionalString(ctx.read("entityId"));
  if (!entityId) {
    return ctx.fail(`Query ${ctx.node.id}: entityId must be a non-empty string.`);
  }
  const result = await resolveWriteResult(ctx.adapters, "rollup_parent_status", { entityId });
  if ("error" in result) {
    return ctx.fail(result.error);
  }
  const applied = ctx.applyWrites({
    updatedIds: result.values.updatedIds,
    derived: result.values.derived
  });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

export async function executeQuery(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const query = ctx.node.data.query;
  if (!query?.op) {
    return ctx.fail(`Query node ${ctx.node.id} requires query.op.`);
  }
  switch (query.op) {
    case "get":
      return executeGet(ctx, query);
    case "list":
      return executeList(ctx, query);
    case "search":
      return executeSearch(ctx, query);
    case "next_work":
      return executeNextWork(ctx, query);
    case "neighborhood":
      return executeNeighborhood(ctx, query);
    case "filter":
      return executeFilter(ctx, query);
    case "create_entity":
      return executeCreate(ctx, query);
    case "update_entity":
      return executeUpdate(ctx);
    case "rollup_parent_status":
      return executeRollup(ctx);
    default:
      return ctx.fail(`Query node ${ctx.node.id} has unsupported op.`);
  }
}

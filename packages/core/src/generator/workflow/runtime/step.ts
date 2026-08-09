import { rankedByQuery, entitySearchValues } from "../../../domain/search";
import {
  compactEntity,
  compactRelation,
  composeTaskPrompt,
  neighborhoodContext,
  rankTaskCandidates,
  type RankedTaskCandidate
} from "../../../domain/task-candidacy";
import type { Entity, EntityRelation, EntityType, JsonRecord } from "../../../domain/types";
import {
  applyBagWrites,
  findNode,
  findStartNode,
  getNodeWrites,
  pickBagKeys,
  resolveNextNodeId,
  slimShapesForReads,
  type WorkflowContextBag,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowFilterWhere
} from "../../../workflow";
import type { WorkflowAdapters, WorkflowMatch, WorkflowToolResult } from "./adapters";

export type {
  FunctionRegistry,
  WorkflowAdapters,
  WorkflowFunctionHandler,
  WorkflowMatch,
  WorkflowToolCall,
  WorkflowToolResult,
  WorkflowWriteCall
} from "./adapters";
export { adaptersFromRegistry, createFunctionRegistry } from "./adapters";

export type WorkflowStepKind =
  | "advanced"
  | "pending_llm"
  | "pending_user"
  | "completed"
  | "failed";

export interface WorkflowLlmPending {
  nodeId: string;
  instructions: string;
  reads: Record<string, unknown>;
  /** Slim bag shapes for declared reads (AI-friendly). */
  shapes?: Record<string, string>;
  outputSchema: string[];
  tools: string[];
}

export interface WorkflowStepResult {
  kind: WorkflowStepKind;
  bag: WorkflowContextBag;
  nodeId: string | null;
  message?: string;
  llm?: WorkflowLlmPending;
}

function fail(bag: WorkflowContextBag, nodeId: string | null, error: string): WorkflowStepResult {
  return {
    kind: "failed",
    bag: { ...bag, status: "failed", error, cursor: nodeId },
    nodeId,
    message: error
  };
}

function readPath(value: unknown, field: string): unknown {
  if (!field) {
    return value;
  }
  const parts = field.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function matchesWhere(item: unknown, where: WorkflowFilterWhere | undefined): boolean {
  if (!where) {
    return true;
  }
  const actual = readPath(item, where.field);
  if (where.op === "eq") {
    return actual === where.value;
  }
  if (where.op === "neq") {
    return actual !== where.value;
  }
  if (where.op === "in") {
    return Array.isArray(where.value) && where.value.includes(actual);
  }
  return false;
}

function projectKeys(item: unknown, keys: string[] | undefined): unknown {
  if (!keys || keys.length === 0 || typeof item !== "object" || item === null) {
    return item;
  }
  const record = item as Record<string, unknown>;
  const projected: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in record) {
      projected[key] = record[key];
    }
  }
  return projected;
}

function mapArgsFromBag(
  mapping: Record<string, string> | undefined,
  bag: WorkflowContextBag
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!mapping) {
    return args;
  }
  for (const [argName, bagKey] of Object.entries(mapping)) {
    args[argName] = bag.keys[bagKey];
  }
  return args;
}

function readValuePath(value: unknown, path: string): unknown {
  if (!path) {
    return value;
  }
  return readPath(value, path);
}

function projectMapFields(
  source: unknown,
  fields: Array<{ from: string; as: string }>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field.as] = readValuePath(source, field.from);
  }
  return out;
}

async function runMap(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag
): Promise<WorkflowStepResult> {
  const map = node.data.map;
  if (!map?.from || !map.as || !map.fields?.length) {
    return fail(bag, node.id, "Map node requires map.from, map.as, and map.fields.");
  }
  const source = bag.keys[map.from];
  const mode = map.mode ?? (Array.isArray(source) ? "array" : "object");
  let value: unknown;
  if (mode === "array") {
    if (!Array.isArray(source)) {
      return fail(bag, node.id, `Map ${node.id}: bag.${map.from} must be an array when mode=array.`);
    }
    value = source.map((item) => projectMapFields(item, map.fields));
  } else {
    if (typeof source !== "object" || source === null || Array.isArray(source)) {
      return fail(bag, node.id, `Map ${node.id}: bag.${map.from} must be an object when mode=object.`);
    }
    value = projectMapFields(source, map.fields);
  }
  const applied = applyBagWrites(bag, [map.as], { [map.as]: value });
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

function defaultLoadContext(
  entities: Entity[],
  input: { query: string; types?: EntityType[]; limit: number }
): WorkflowMatch[] {
  const pool = input.types?.length
    ? entities.filter((entity) => input.types!.includes(entity.type))
    : entities;
  const ranked = rankedByQuery(pool, input.query, entitySearchValues);
  return ranked.slice(0, input.limit).map(({ item, score }) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    summary: item.summary,
    score
  }));
}

function loadAllEntities(entities: Entity[], types?: EntityType[], limit?: number): WorkflowMatch[] {
  const pool = types?.length ? entities.filter((entity) => types.includes(entity.type)) : entities;
  const sliced = typeof limit === "number" ? pool.slice(0, limit) : pool;
  return sliced.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    summary: item.summary,
    key: item.key
  }));
}

function asEntityList(value: unknown, fallback: Entity[]): Entity[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }
  if (value.every((item) => typeof item === "object" && item !== null && "id" in item && "type" in item)) {
    return value as Entity[];
  }
  return fallback;
}

function asRelationList(value: unknown, fallback: EntityRelation[]): EntityRelation[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  if (
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        ("sourceEntityId" in item || "from" in item) &&
        ("targetEntityId" in item || "to" in item)
    )
  ) {
    return value.map((item) => {
      const record = item as Record<string, unknown>;
      if (typeof record.sourceEntityId === "string" && typeof record.targetEntityId === "string") {
        return item as EntityRelation;
      }
      return {
        id: typeof record.id === "string" ? record.id : `${record.from}->${record.to}`,
        projectId: typeof record.projectId === "string" ? record.projectId : "project",
        sourceEntityId: String(record.from),
        targetEntityId: String(record.to),
        type: (typeof record.type === "string" ? record.type : "related_to") as EntityRelation["type"],
        label: typeof record.label === "string" ? record.label : null,
        isPrimary: Boolean(record.primary),
        metadata: {}
      };
    });
  }
  return fallback;
}

function selectedEntityId(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

async function advanceCursor(
  graph: WorkflowGraph,
  bag: WorkflowContextBag,
  fromNodeId: string,
  routeLabel = "default"
): Promise<WorkflowStepResult> {
  const nextId = resolveNextNodeId(graph, fromNodeId, routeLabel);
  if (!nextId) {
    return {
      kind: "completed",
      bag: { ...bag, cursor: null, status: "completed" },
      nodeId: fromNodeId,
      message: "No outgoing edge; treating as completed."
    };
  }
  return {
    kind: "advanced",
    bag: { ...bag, cursor: nextId, status: "running", error: undefined },
    nodeId: nextId
  };
}

async function runStart(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag
): Promise<WorkflowStepResult> {
  const writes = getNodeWrites(node);
  const values: Record<string, unknown> = {};
  if (writes.includes("goal")) {
    values.goal = bag.goal;
  }
  for (const key of writes) {
    if (!(key in values) && key in bag.keys) {
      values[key] = bag.keys[key];
    }
  }
  if (writes.length > 0) {
    const applied = applyBagWrites(bag, writes, values);
    if (!applied.ok) {
      return fail(bag, node.id, applied.error);
    }
    return advanceCursor(graph, applied.bag, node.id);
  }
  return advanceCursor(graph, bag, node.id);
}

async function runContext(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag,
  adapters: WorkflowAdapters,
  entities: Entity[],
  relations: EntityRelation[]
): Promise<WorkflowStepResult> {
  const load = node.data.auto?.loadContext;
  if (!load) {
    return fail(bag, node.id, `Context node ${node.id} requires auto.loadContext.`);
  }

  const mode = load.mode ?? "query";
  const writes = getNodeWrites(node);
  const values: Record<string, unknown> = {};

  if (mode === "all") {
    const matches = adapters.loadContext
      ? await adapters.loadContext({
          query: "",
          types: load.types,
          limit: load.limit ?? Number.MAX_SAFE_INTEGER,
          mode: "all"
        })
      : loadAllEntities(entities, load.types, load.limit);
    const entityWrite = writes.find((key) => key !== "relations") ?? writes[0] ?? "entities";
    values[entityWrite] = matches.map((item) => {
      const full = entities.find((entity) => entity.id === item.id);
      return full ? compactEntity(full) : item;
    });
    if (writes.includes("relations")) {
      values.relations = relations.map(compactRelation);
    }
  } else {
    if (!load.queryFrom) {
      return fail(bag, node.id, `Context node ${node.id} requires auto.loadContext.queryFrom when mode is query.`);
    }
    const queryValue = bag.keys[load.queryFrom];
    if (typeof queryValue !== "string") {
      return fail(bag, node.id, `Context node ${node.id} queryFrom '${load.queryFrom}' is not a string.`);
    }
    const limit = load.limit ?? 10;
    const matches = adapters.loadContext
      ? await adapters.loadContext({ query: queryValue, types: load.types, limit, mode: "query" })
      : defaultLoadContext(entities, { query: queryValue, types: load.types, limit });
    values[writes[0] ?? "matches"] = matches;
  }

  const applied = applyBagWrites(bag, writes, values);
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function runFilter(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag,
  entities: Entity[],
  relations: EntityRelation[],
  adapters: WorkflowAdapters
): Promise<WorkflowStepResult> {
  const filter = node.data.auto?.filter;
  if (!filter) {
    return fail(bag, node.id, `Filter node ${node.id} requires auto.filter.`);
  }
  const writes = getNodeWrites(node);

  if (filter.rank === "task_candidates") {
    // Prefer full runtime entities (bag may only hold compact projections).
    const candidates = rankTaskCandidates(entities, relations, {
      criticalTaggedIds: adapters.criticalTaggedIds
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
    const applied = applyBagWrites(bag, writes, values);
    if (!applied.ok) {
      return fail(bag, node.id, applied.error);
    }
    return advanceCursor(graph, applied.bag, node.id);
  }

  const source = bag.keys[filter.from];
  if (!Array.isArray(source)) {
    return fail(bag, node.id, `Filter node ${node.id} source '${filter.from}' is not an array.`);
  }
  const filtered = source.filter((item) => matchesWhere(item, filter.where)).map((item) => projectKeys(item, filter.keys));
  const applied = applyBagWrites(bag, writes, { [writes[0] ?? "filtered"]: filtered });
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function runAssign(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag,
  entities: Entity[],
  relations: EntityRelation[]
): Promise<WorkflowStepResult> {
  const assign = node.data.auto?.assign;
  if (!assign) {
    return fail(bag, node.id, `Assign requires auto.assign on node ${node.id}.`);
  }
  const writes = getNodeWrites(node);
  const values: Record<string, unknown> = { ...(assign.set ?? {}) };

  if (assign.pickFirst) {
    const source = bag.keys[assign.pickFirst.from];
    if (!Array.isArray(source) || source.length === 0) {
      return fail(bag, node.id, `pickFirst source '${assign.pickFirst.from}' is empty.`);
    }
    const targetKey = writes.find((key) => !(key in values)) ?? writes[0] ?? "selected";
    values[targetKey] = source[0];
  }

  if (assign.neighborhoodOf) {
    const selectedId = selectedEntityId(bag.keys[assign.neighborhoodOf.of]);
    if (!selectedId) {
      return fail(bag, node.id, `neighborhoodOf.of '${assign.neighborhoodOf.of}' has no id.`);
    }
    const entityList = asEntityList(
      bag.keys[assign.neighborhoodOf.entitiesFrom ?? "entities"],
      entities
    );
    const relationList = asRelationList(
      bag.keys[assign.neighborhoodOf.relationsFrom ?? "relations"],
      relations
    );
    const targetKey = writes.find((key) => !(key in values)) ?? writes[0] ?? "taskContext";
    values[targetKey] = neighborhoodContext(selectedId, entityList, relationList);
  }

  if (assign.composeTaskPrompt) {
    const task = bag.keys[assign.composeTaskPrompt.taskFrom];
    const context = bag.keys[assign.composeTaskPrompt.contextFrom];
    if (!task || typeof task !== "object") {
      return fail(bag, node.id, `composeTaskPrompt.taskFrom '${assign.composeTaskPrompt.taskFrom}' missing.`);
    }
    const targetKey = writes.find((key) => !(key in values)) ?? writes[0] ?? "agentPrompt";
    values[targetKey] = composeTaskPrompt({
      task: task as RankedTaskCandidate,
      context: context ?? {}
    });
  }

  if (!assign.set && !assign.pickFirst && !assign.neighborhoodOf && !assign.composeTaskPrompt) {
    return fail(bag, node.id, `Assign requires auto.assign.set (or pickFirst/neighborhoodOf/composeTaskPrompt) on node ${node.id}.`);
  }

  const applied = applyBagWrites(bag, writes, values);
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function resolveToolResult(
  adapters: WorkflowAdapters,
  name: string,
  args: Record<string, unknown>
): Promise<WorkflowToolResult | { error: string }> {
  if (adapters.runTool) {
    return adapters.runTool({ name, args });
  }
  const handler = adapters.functions?.[name];
  if (!handler) {
    return { error: `No runTool adapter or registry function for tool '${name}'.` };
  }
  return handler(args);
}

async function resolveWriteResult(
  adapters: WorkflowAdapters,
  action: "create_entity" | "update_entity",
  args: Record<string, unknown>
): Promise<WorkflowToolResult | { error: string }> {
  if (adapters.runWrite) {
    return adapters.runWrite({ action, args });
  }
  const handler = adapters.functions?.[action];
  if (!handler) {
    return { error: `No runWrite adapter or registry function for action '${action}'.` };
  }
  return handler(args);
}

async function runTool(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag,
  adapters: WorkflowAdapters
): Promise<WorkflowStepResult> {
  const tool = node.data.tool;
  if (!tool?.name) {
    return fail(bag, node.id, `Tool node ${node.id} requires tool.name.`);
  }
  const args = mapArgsFromBag(tool.argsFromBag, bag);
  const result = await resolveToolResult(adapters, tool.name, args);
  if ("error" in result) {
    return fail(bag, node.id, result.error);
  }
  const writes = getNodeWrites(node);
  const applied = applyBagWrites(bag, writes, result.values);
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function runWrite(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag,
  adapters: WorkflowAdapters
): Promise<WorkflowStepResult> {
  const write = node.data.write;
  if (!write?.action) {
    return fail(bag, node.id, `Write node ${node.id} requires write.action.`);
  }
  const args = {
    ...(write.defaults ?? {}),
    ...mapArgsFromBag(write.argsFromBag, bag)
  };
  const result = await resolveWriteResult(adapters, write.action, args);
  if ("error" in result) {
    return fail(bag, node.id, result.error);
  }
  const writes = getNodeWrites(node);
  const applied = applyBagWrites(bag, writes, result.values);
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function runLlm(
  node: WorkflowNode,
  bag: WorkflowContextBag,
  adapters: WorkflowAdapters,
  graph: WorkflowGraph
): Promise<WorkflowStepResult> {
  const llm = node.data.llm ?? {};
  let instructions = llm.instructions ?? "";
  if (!instructions && llm.instructionRef) {
    instructions = (await adapters.resolveInstruction?.(llm.instructionRef)) ?? "";
  }
  if (!instructions.trim()) {
    return fail(bag, node.id, `LLM node ${node.id} requires instructions or instructionRef.`);
  }

  const inputKeys = llm.inputKeys ?? node.data.reads ?? [];
  const outputSchema = llm.outputSchema ?? getNodeWrites(node);
  const reads = pickBagKeys(bag, inputKeys);
  const shapes = slimShapesForReads(graph, node.id, inputKeys).keys;

  return {
    kind: "pending_llm",
    bag: { ...bag, status: "pending_llm", cursor: node.id },
    nodeId: node.id,
    message: "LLM step requires external completion.",
    llm: {
      nodeId: node.id,
      instructions,
      reads,
      shapes,
      outputSchema,
      tools: llm.tools ?? []
    }
  };
}

function evaluateSimpleCondition(expression: string | undefined, bag: WorkflowContextBag): boolean {
  if (!expression) {
    return false;
  }
  const trimmed = expression.trim();
  const notMatch = /^!\s*([a-zA-Z0-9_]+)$/.exec(trimmed);
  if (notMatch) {
    return !Boolean(bag.keys[notMatch[1]]);
  }
  const keyMatch = /^([a-zA-Z0-9_]+)$/.exec(trimmed);
  if (keyMatch) {
    return Boolean(bag.keys[keyMatch[1]]);
  }
  const eqMatch = /^([a-zA-Z0-9_]+)\s*==\s*(.+)$/.exec(trimmed);
  if (eqMatch) {
    const left = bag.keys[eqMatch[1]];
    let rightRaw = eqMatch[2].trim();
    if (
      (rightRaw.startsWith('"') && rightRaw.endsWith('"')) ||
      (rightRaw.startsWith("'") && rightRaw.endsWith("'"))
    ) {
      rightRaw = rightRaw.slice(1, -1);
    } else if (rightRaw === "true") {
      return left === true;
    } else if (rightRaw === "false") {
      return left === false;
    } else if (rightRaw === "null") {
      return left === null;
    } else if (!Number.isNaN(Number(rightRaw))) {
      return left === Number(rightRaw);
    }
    return left === rightRaw;
  }
  return Boolean(bag.keys[trimmed]);
}

async function runGate(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag
): Promise<WorkflowStepResult> {
  const gate = node.data.gate ?? {};
  if (evaluateSimpleCondition(gate.stopIf, bag)) {
    return fail(bag, node.id, `Gate ${node.id} stopIf matched.`);
  }
  if (evaluateSimpleCondition(gate.askUserIf, bag)) {
    return {
      kind: "pending_user",
      bag: { ...bag, status: "pending_user", cursor: node.id },
      nodeId: node.id,
      message: `Gate ${node.id} requires user input.`
    };
  }

  let route = "default";
  if (gate.routes) {
    for (const [expression, label] of Object.entries(gate.routes)) {
      if (evaluateSimpleCondition(expression, bag)) {
        route = label;
        break;
      }
    }
  }
  return advanceCursor(graph, bag, node.id, route);
}

/**
 * Advance a workflow one node. Deterministic nodes execute immediately;
 * LLM nodes return pending_llm with declared reads only (never the whole graph).
 */
export async function stepWorkflow(input: {
  graph: WorkflowGraph;
  bag: WorkflowContextBag;
  adapters?: WorkflowAdapters;
  entities?: Entity[];
  relations?: EntityRelation[];
  /** When completing an LLM node, supply writes produced by the model. */
  llmWrites?: Record<string, unknown>;
  /** When completing a user gate, choose a route label. */
  userRoute?: string;
}): Promise<WorkflowStepResult> {
  const adapters = input.adapters ?? {};
  const entities = input.entities ?? [];
  const relations = input.relations ?? [];
  let bag = { ...input.bag, keys: { ...input.bag.keys } };

  if (!bag.cursor) {
    const start = findStartNode(input.graph);
    if (!start) {
      return fail(bag, null, "Workflow has no start node.");
    }
    bag = { ...bag, cursor: start.id, status: "running" };
  }

  const cursor = bag.cursor;
  if (!cursor) {
    return fail(bag, null, "Workflow has no cursor.");
  }

  const node = findNode(input.graph, cursor);
  if (!node) {
    return fail(bag, cursor, `Unknown cursor node: ${cursor}`);
  }

  if (node.type === "end" || node.type === "error_end") {
    return {
      kind: "completed",
      bag: {
        ...bag,
        cursor: null,
        status: node.type === "error_end" ? "failed" : "completed",
        error: node.type === "error_end" ? "Workflow ended in error." : undefined
      },
      nodeId: node.id,
      message: node.type === "error_end" ? "Workflow ended in error." : "Workflow completed."
    };
  }

  if (node.type === "llm" && input.llmWrites) {
    const applied = applyBagWrites(bag, getNodeWrites(node), input.llmWrites);
    if (!applied.ok) {
      return fail(bag, node.id, applied.error);
    }
    return advanceCursor(input.graph, applied.bag, node.id);
  }

  if (node.type === "gate" && input.userRoute) {
    return advanceCursor(input.graph, { ...bag, status: "running" }, node.id, input.userRoute);
  }

  const assignOnly =
    Boolean(node.data.auto?.assign) &&
    !node.data.auto?.loadContext &&
    !node.data.auto?.filter;

  switch (node.type) {
    case "start":
      return runStart(input.graph, node, bag);
    case "context":
      if (assignOnly) {
        return runAssign(input.graph, node, bag, entities, relations);
      }
      return runContext(input.graph, node, bag, adapters, entities, relations);
    case "transform":
      if (assignOnly) {
        return runAssign(input.graph, node, bag, entities, relations);
      }
      return runFilter(input.graph, node, bag, entities, relations, adapters);
    case "map":
      return runMap(input.graph, node, bag);
    case "tool":
      return runTool(input.graph, node, bag, adapters);
    case "write":
      return runWrite(input.graph, node, bag, adapters);
    case "llm":
      return runLlm(node, bag, adapters, input.graph);
    case "gate":
      return runGate(input.graph, node, bag);
    case "switch": {
      const on = node.data.switch?.on ?? "route";
      const value = bag.keys[on];
      const label = value === undefined || value === null ? "default" : String(value);
      return advanceCursor(input.graph, bag, node.id, label);
    }
    case "fork":
    case "join":
    case "foreach":
    case "wait":
    case "subworkflow":
      return fail(
        bag,
        node.id,
        `Node type ${node.type} is in the v2 contract but not executed by the minimal runner yet.`
      );
    default:
      return fail(bag, node.id, `Unsupported node type: ${(node as WorkflowNode).type}`);
  }
}

/** Run deterministic nodes until LLM/user pending, completion, or failure. */
export async function runWorkflowUntilPause(input: {
  graph: WorkflowGraph;
  bag: WorkflowContextBag;
  adapters?: WorkflowAdapters;
  entities?: Entity[];
  relations?: EntityRelation[];
  maxSteps?: number;
}): Promise<WorkflowStepResult> {
  let bag = input.bag;
  let last: WorkflowStepResult | null = null;
  const maxSteps = input.maxSteps ?? 50;

  for (let i = 0; i < maxSteps; i += 1) {
    last = await stepWorkflow({
      graph: input.graph,
      bag,
      adapters: input.adapters,
      entities: input.entities,
      relations: input.relations
    });
    bag = last.bag;
    if (last.kind !== "advanced") {
      return last;
    }
  }

  return (
    last ??
    fail(bag, bag.cursor, "Workflow exceeded maxSteps.")
  );
}

export function workflowGraphFromMetadata(metadata: JsonRecord): WorkflowGraph | null {
  const graph = metadata.graph;
  if (!graph || typeof graph !== "object") {
    return null;
  }
  return graph as WorkflowGraph;
}

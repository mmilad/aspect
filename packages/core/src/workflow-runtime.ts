import { rankedByQuery, entitySearchValues } from "./search";
import type { Entity, EntityType, JsonRecord } from "./types";
import {
  applyBagWrites,
  findNode,
  findStartNode,
  getNodeWrites,
  pickBagKeys,
  resolveNextNodeId,
  type WorkflowContextBag,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowFilterWhere
} from "./workflow";

export interface WorkflowMatch {
  id: string;
  type: EntityType;
  title: string;
  status: string;
  summary?: string;
  score?: number;
  [key: string]: unknown;
}

export interface WorkflowToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface WorkflowToolResult {
  values: Record<string, unknown>;
}

export interface WorkflowWriteCall {
  action: "create_entity" | "update_entity";
  args: Record<string, unknown>;
}

export interface WorkflowAdapters {
  loadContext?: (input: {
    query: string;
    types?: EntityType[];
    limit: number;
  }) => Promise<WorkflowMatch[]> | WorkflowMatch[];
  runTool?: (call: WorkflowToolCall) => Promise<WorkflowToolResult> | WorkflowToolResult;
  runWrite?: (call: WorkflowWriteCall) => Promise<WorkflowToolResult> | WorkflowToolResult;
  resolveInstruction?: (instructionRef: string) => Promise<string | null> | string | null;
}

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
  entities: Entity[]
): Promise<WorkflowStepResult> {
  const load = node.data.auto?.loadContext;
  if (!load) {
    return fail(bag, node.id, `Context node ${node.id} requires auto.loadContext.`);
  }
  const queryValue = bag.keys[load.queryFrom];
  if (typeof queryValue !== "string") {
    return fail(bag, node.id, `Context node ${node.id} queryFrom '${load.queryFrom}' is not a string.`);
  }
  const limit = load.limit ?? 10;
  const matches = adapters.loadContext
    ? await adapters.loadContext({ query: queryValue, types: load.types, limit })
    : defaultLoadContext(entities, { query: queryValue, types: load.types, limit });

  const writes = getNodeWrites(node);
  const applied = applyBagWrites(bag, writes, { [writes[0] ?? "matches"]: matches });
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function runFilter(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag
): Promise<WorkflowStepResult> {
  const filter = node.data.auto?.filter;
  if (!filter) {
    return fail(bag, node.id, `Filter node ${node.id} requires auto.filter.`);
  }
  const source = bag.keys[filter.from];
  if (!Array.isArray(source)) {
    return fail(bag, node.id, `Filter node ${node.id} source '${filter.from}' is not an array.`);
  }
  const filtered = source.filter((item) => matchesWhere(item, filter.where)).map((item) => projectKeys(item, filter.keys));
  const writes = getNodeWrites(node);
  const applied = applyBagWrites(bag, writes, { [writes[0] ?? "filtered"]: filtered });
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
}

async function runAssign(
  graph: WorkflowGraph,
  node: WorkflowNode,
  bag: WorkflowContextBag
): Promise<WorkflowStepResult> {
  const assign = node.data.auto?.assign;
  if (!assign?.set) {
    return fail(bag, node.id, `Assign requires auto.assign.set on node ${node.id}.`);
  }
  const writes = getNodeWrites(node);
  const applied = applyBagWrites(bag, writes, assign.set);
  if (!applied.ok) {
    return fail(bag, node.id, applied.error);
  }
  return advanceCursor(graph, applied.bag, node.id);
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
  if (!adapters.runTool) {
    return fail(bag, node.id, `No runTool adapter for tool '${tool.name}'.`);
  }
  const args = mapArgsFromBag(tool.argsFromBag, bag);
  const result = await adapters.runTool({ name: tool.name, args });
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
  if (!adapters.runWrite) {
    return fail(bag, node.id, `No runWrite adapter for action '${write.action}'.`);
  }
  const args = {
    ...(write.defaults ?? {}),
    ...mapArgsFromBag(write.argsFromBag, bag)
  };
  const result = await adapters.runWrite({ action: write.action, args });
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
  adapters: WorkflowAdapters
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

  return {
    kind: "pending_llm",
    bag: { ...bag, status: "pending_llm", cursor: node.id },
    nodeId: node.id,
    message: "LLM step requires external completion.",
    llm: {
      nodeId: node.id,
      instructions,
      reads,
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
  /** When completing an LLM node, supply writes produced by the model. */
  llmWrites?: Record<string, unknown>;
  /** When completing a user gate, choose a route label. */
  userRoute?: string;
}): Promise<WorkflowStepResult> {
  const adapters = input.adapters ?? {};
  const entities = input.entities ?? [];
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

  if (node.type === "end") {
    return {
      kind: "completed",
      bag: { ...bag, cursor: null, status: "completed", error: undefined },
      nodeId: node.id,
      message: "Workflow completed."
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

  if (node.data.auto?.assign && (node.type === "context" || node.type === "filter")) {
    // allow assign on auto-capable nodes when no load/filter present
  }

  switch (node.type) {
    case "start":
      return runStart(input.graph, node, bag);
    case "context":
      if (node.data.auto?.assign && !node.data.auto.loadContext) {
        return runAssign(input.graph, node, bag);
      }
      return runContext(input.graph, node, bag, adapters, entities);
    case "filter":
      if (node.data.auto?.assign && !node.data.auto.filter) {
        return runAssign(input.graph, node, bag);
      }
      return runFilter(input.graph, node, bag);
    case "tool":
      return runTool(input.graph, node, bag, adapters);
    case "write":
      return runWrite(input.graph, node, bag, adapters);
    case "llm":
      return runLlm(node, bag, adapters);
    case "gate":
      return runGate(input.graph, node, bag);
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
      entities: input.entities
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

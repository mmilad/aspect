import type { JsonRecord } from "../domain/types";
import { parseBagShape } from "./shapes";
import {
  WORKFLOW_SCHEMA_VERSION,
  workflowEdgeKinds,
  workflowNodeTypes,
  workflowRetryOnValues,
  type WorkflowBagKeyContract,
  type WorkflowContextBag,
  type WorkflowEdge,
  type WorkflowEdgeKind,
  type WorkflowExecutionPolicy,
  type WorkflowForeachConfig,
  type WorkflowGraph,
  type WorkflowJoinConfig,
  type WorkflowMapConfig,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType,
  type WorkflowParseOutcome,
  type WorkflowPosition,
  type WorkflowRetryOn,
  type WorkflowSubworkflowConfig,
  type WorkflowWaitConfig
} from "./types";

const WORKFLOW_RETRY_ON_SET = new Set<string>(workflowRetryOnValues);

export * from "./types";
export {
  bagViewAtNode,
  BAG_SHAPE_CATALOG,
  deriveMapOutputShape,
  inferNodeOutputShapes,
  listShapePaths,
  parseBagShape,
  resolveBagShape,
  serializeBagViewSlim,
  serializeShapeSlim,
  slimShapesForReads,
  warnShapeMismatches
} from "./shapes";

const WORKFLOW_NODE_TYPE_SET = new Set<string>(workflowNodeTypes);
const WORKFLOW_EDGE_KIND_SET = new Set<string>(workflowEdgeKinds);
const LEGACY_NODE_TYPES = new Set(["filter"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is WorkflowPosition {
  return isRecord(value) && typeof value.x === "number" && typeof value.y === "number";
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return value;
}

function asStringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      return undefined;
    }
    out[key] = item;
  }
  return out;
}

function normalizeNodeType(raw: string): WorkflowNodeType | null {
  if (raw === "filter") {
    return "transform";
  }
  if (WORKFLOW_NODE_TYPE_SET.has(raw)) {
    return raw as WorkflowNodeType;
  }
  return null;
}

function parseExecutionPolicy(raw: unknown, nodeId: string, errors: string[]): WorkflowExecutionPolicy | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} executionPolicy must be an object.`);
    return undefined;
  }
  const policy: WorkflowExecutionPolicy = {};
  if (raw.timeoutMs !== undefined) {
    if (typeof raw.timeoutMs !== "number" || !Number.isFinite(raw.timeoutMs) || raw.timeoutMs < 0) {
      errors.push(`Node ${nodeId} executionPolicy.timeoutMs must be a non-negative number.`);
    } else {
      policy.timeoutMs = raw.timeoutMs;
    }
  }
  if (raw.onExhausted !== undefined) {
    if (raw.onExhausted !== "error_edge" && raw.onExhausted !== "fail_run") {
      errors.push(`Node ${nodeId} executionPolicy.onExhausted must be error_edge|fail_run.`);
    } else {
      policy.onExhausted = raw.onExhausted;
    }
  }
  if (typeof raw.idempotencyKeyFrom === "string") {
    policy.idempotencyKeyFrom = raw.idempotencyKeyFrom;
  }
  if (raw.sideEffect !== undefined) {
    if (raw.sideEffect !== "unknown" && raw.sideEffect !== "idempotent" && raw.sideEffect !== "non_idempotent") {
      errors.push(`Node ${nodeId} executionPolicy.sideEffect is invalid.`);
    } else {
      policy.sideEffect = raw.sideEffect;
    }
  }
  if (raw.retry !== undefined) {
    if (!isRecord(raw.retry)) {
      errors.push(`Node ${nodeId} executionPolicy.retry must be an object.`);
    } else {
      const maxAttempts = raw.retry.maxAttempts;
      if (typeof maxAttempts !== "number" || !Number.isInteger(maxAttempts) || maxAttempts < 1) {
        errors.push(`Node ${nodeId} executionPolicy.retry.maxAttempts must be a positive integer.`);
      } else {
        policy.retry = {
          maxAttempts,
          backoffMs: typeof raw.retry.backoffMs === "number" ? raw.retry.backoffMs : undefined,
          backoff: raw.retry.backoff === "fixed" || raw.retry.backoff === "exponential" ? raw.retry.backoff : undefined,
          retryOn: Array.isArray(raw.retry.retryOn)
            ? (raw.retry.retryOn.filter(
                (item): item is WorkflowRetryOn => typeof item === "string" && WORKFLOW_RETRY_ON_SET.has(item)
              ) as WorkflowRetryOn[])
            : undefined
        };
      }
    }
  }
  return policy;
}

function parseJoinConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowJoinConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} join config must be an object.`);
    return undefined;
  }
  const join: WorkflowJoinConfig = {};
  if (raw.mode === "all" || raw.mode === "any") {
    join.mode = raw.mode;
  } else if (isRecord(raw.mode) && typeof raw.mode.count === "number" && Number.isInteger(raw.mode.count)) {
    join.mode = { count: raw.mode.count };
  } else if (raw.mode !== undefined) {
    errors.push(`Node ${nodeId} join.mode must be all|any|{count}.`);
  }
  if (raw.remaining === "cancel_remaining" || raw.remaining === "ignore_remaining") {
    join.remaining = raw.remaining;
  } else if (raw.remaining !== undefined) {
    errors.push(`Node ${nodeId} join.remaining must be cancel_remaining|ignore_remaining.`);
  }
  if (raw.merge !== undefined) {
    if (!isRecord(raw.merge)) {
      errors.push(`Node ${nodeId} join.merge must be an object.`);
    } else {
      const strategy = raw.merge.strategy;
      if (
        strategy !== undefined &&
        strategy !== "object_per_arm" &&
        strategy !== "prefer_first" &&
        strategy !== "prefer_last" &&
        strategy !== "fail_on_conflict"
      ) {
        errors.push(`Node ${nodeId} join.merge.strategy is invalid.`);
      } else {
        join.merge = {
          strategy,
          as: typeof raw.merge.as === "string" ? raw.merge.as : undefined,
          keys: asStringArray(raw.merge.keys)
        };
      }
    }
  }
  return join;
}

function parseForeachConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowForeachConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} foreach config must be an object.`);
    return undefined;
  }
  if (typeof raw.itemsFrom !== "string" || !raw.itemsFrom.trim()) {
    errors.push(`Node ${nodeId} foreach.itemsFrom is required.`);
    return undefined;
  }
  if (!isRecord(raw.body)) {
    errors.push(`Node ${nodeId} foreach.body is required.`);
    return undefined;
  }
  let body: WorkflowForeachConfig["body"] | null = null;
  if (raw.body.type === "subworkflow" && typeof raw.body.workflowId === "string") {
    body = {
      type: "subworkflow",
      workflowId: raw.body.workflowId,
      inputMap: asStringMap(raw.body.inputMap),
      outputMap: asStringMap(raw.body.outputMap)
    };
  } else if (
    raw.body.type === "subgraph" &&
    typeof raw.body.entryNodeId === "string" &&
    typeof raw.body.exitNodeId === "string"
  ) {
    body = {
      type: "subgraph",
      entryNodeId: raw.body.entryNodeId,
      exitNodeId: raw.body.exitNodeId
    };
  } else {
    errors.push(`Node ${nodeId} foreach.body must be subworkflow|{subgraph entry/exit}.`);
    return undefined;
  }

  const collect =
    isRecord(raw.collect) && typeof raw.collect.as === "string"
      ? {
          from:
            typeof raw.collect.from === "string"
              ? raw.collect.from
              : Array.isArray(raw.collect.from)
                ? (raw.collect.from.filter((item) => typeof item === "string") as string[])
                : "",
          as: raw.collect.as
        }
      : undefined;

  return {
    itemsFrom: raw.itemsFrom,
    itemKey: typeof raw.itemKey === "string" ? raw.itemKey : undefined,
    indexKey: typeof raw.indexKey === "string" ? raw.indexKey : undefined,
    body,
    concurrency: typeof raw.concurrency === "number" ? raw.concurrency : undefined,
    failureMode: raw.failureMode === "fail" || raw.failureMode === "continue" ? raw.failureMode : undefined,
    collect: collect && (typeof collect.from === "string" || collect.from.length > 0) ? collect : undefined
  };
}

function parseWaitConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowWaitConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} wait config must be an object.`);
    return undefined;
  }
  const wait: WorkflowWaitConfig = {
    delayMs: typeof raw.delayMs === "number" ? raw.delayMs : undefined,
    until: typeof raw.until === "string" ? raw.until : undefined
  };
  if (wait.delayMs === undefined && !wait.until) {
    errors.push(`Node ${nodeId} wait requires delayMs or until.`);
  }
  return wait;
}

function parseSubworkflowConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowSubworkflowConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw) || typeof raw.workflowId !== "string" || !raw.workflowId.trim()) {
    errors.push(`Node ${nodeId} subworkflow.workflowId is required.`);
    return undefined;
  }
  return {
    workflowId: raw.workflowId,
    inputMap: asStringMap(raw.inputMap),
    outputMap: asStringMap(raw.outputMap)
  };
}

function parseBagKeyContracts(
  raw: unknown,
  nodeId: string,
  field: string,
  errors: string[]
): Record<string, WorkflowBagKeyContract> | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} data.${field} must be an object.`);
    return undefined;
  }
  const out: Record<string, WorkflowBagKeyContract> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      errors.push(`Node ${nodeId} data.${field}.${key} must be an object.`);
      continue;
    }
    const shape = value.shape !== undefined ? parseBagShape(value.shape) : undefined;
    if (value.shape !== undefined && !shape) {
      errors.push(`Node ${nodeId} data.${field}.${key}.shape is invalid.`);
    }
    out[key] = {
      required: typeof value.required === "boolean" ? value.required : undefined,
      shape
    };
  }
  return out;
}

function parseMapConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowMapConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} map config must be an object.`);
    return undefined;
  }
  if (typeof raw.from !== "string" || !raw.from.trim()) {
    errors.push(`Node ${nodeId} map.from is required.`);
    return undefined;
  }
  if (typeof raw.as !== "string" || !raw.as.trim()) {
    errors.push(`Node ${nodeId} map.as is required.`);
    return undefined;
  }
  if (!Array.isArray(raw.fields) || raw.fields.length === 0) {
    errors.push(`Node ${nodeId} map.fields must be a non-empty array.`);
    return undefined;
  }
  const fields: WorkflowMapConfig["fields"] = [];
  for (const item of raw.fields) {
    if (!isRecord(item) || typeof item.from !== "string" || typeof item.as !== "string") {
      errors.push(`Node ${nodeId} map.fields entries require from and as strings.`);
      continue;
    }
    fields.push({ from: item.from, as: item.as });
  }
  if (fields.length === 0) {
    return undefined;
  }
  return {
    from: raw.from,
    as: raw.as,
    mode: raw.mode === "array" || raw.mode === "object" ? raw.mode : undefined,
    fields
  };
}

function parseNodeData(raw: unknown, nodeId: string, errors: string[]): WorkflowNodeData | null {
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} data must be an object.`);
    return null;
  }
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    errors.push(`Node ${nodeId} requires data.title.`);
    return null;
  }

  const reads = asStringArray(raw.reads);
  if (raw.reads !== undefined && !reads) {
    errors.push(`Node ${nodeId} data.reads must be string[].`);
  }
  const writes = asStringArray(raw.writes);
  if (raw.writes !== undefined && !writes) {
    errors.push(`Node ${nodeId} data.writes must be string[].`);
  }
  const outputs = asStringArray(raw.outputs);
  if (raw.outputs !== undefined && !outputs) {
    errors.push(`Node ${nodeId} data.outputs must be string[].`);
  }

  const map = parseMapConfig(raw.map, nodeId, errors);
  const writesList = writes ?? outputs ?? [];
  if (map && !writesList.includes(map.as)) {
    // Auto-include map.as in writes for convenience when omitted.
  }

  return {
    ...raw,
    title: raw.title,
    reads,
    writes: map && writes && !writes.includes(map.as) ? [...writes, map.as] : writes,
    outputs,
    inputs: parseBagKeyContracts(raw.inputs, nodeId, "inputs", errors),
    outputContracts: parseBagKeyContracts(raw.outputContracts, nodeId, "outputContracts", errors),
    auto: isRecord(raw.auto) ? (raw.auto as unknown as WorkflowNodeData["auto"]) : undefined,
    tool: isRecord(raw.tool) ? (raw.tool as unknown as WorkflowNodeData["tool"]) : undefined,
    llm: isRecord(raw.llm) ? (raw.llm as unknown as WorkflowNodeData["llm"]) : undefined,
    write: isRecord(raw.write) ? (raw.write as unknown as WorkflowNodeData["write"]) : undefined,
    gate: isRecord(raw.gate) ? (raw.gate as unknown as WorkflowNodeData["gate"]) : undefined,
    switch: isRecord(raw.switch) ? (raw.switch as unknown as WorkflowNodeData["switch"]) : undefined,
    join: parseJoinConfig(raw.join, nodeId, errors),
    foreach: parseForeachConfig(raw.foreach, nodeId, errors),
    map,
    wait: parseWaitConfig(raw.wait, nodeId, errors),
    subworkflow: parseSubworkflowConfig(raw.subworkflow, nodeId, errors),
    executionPolicy: parseExecutionPolicy(raw.executionPolicy, nodeId, errors)
  };
}

function parseNode(raw: unknown, errors: string[]): WorkflowNode | null {
  if (!isRecord(raw)) {
    errors.push("Each workflow node must be an object.");
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    errors.push("Workflow node requires id.");
    return null;
  }
  if (typeof raw.type !== "string") {
    errors.push(`Node ${raw.id} has invalid type.`);
    return null;
  }
  const type = normalizeNodeType(raw.type);
  if (!type) {
    if (!LEGACY_NODE_TYPES.has(raw.type)) {
      errors.push(`Node ${raw.id} has invalid type.`);
    }
    return null;
  }
  if (!isPosition(raw.position)) {
    errors.push(`Node ${raw.id} requires position {x,y}.`);
    return null;
  }

  const data = parseNodeData(raw.data, raw.id, errors);
  if (!data) {
    return null;
  }

  return {
    id: raw.id,
    type,
    position: { x: raw.position.x, y: raw.position.y },
    data
  };
}

function inferEdgeKind(raw: Record<string, unknown>, sourceType: WorkflowNodeType | undefined): WorkflowEdgeKind {
  if (typeof raw.kind === "string" && WORKFLOW_EDGE_KIND_SET.has(raw.kind)) {
    return raw.kind as WorkflowEdgeKind;
  }
  if (sourceType === "switch" || sourceType === "gate") {
    if (typeof raw.label === "string" && raw.label && raw.label !== "default") {
      return "route";
    }
  }
  return "next";
}

function parseEdge(
  raw: unknown,
  errors: string[],
  nodeTypeById: Map<string, WorkflowNodeType>
): WorkflowEdge | null {
  if (!isRecord(raw)) {
    errors.push("Each workflow edge must be an object.");
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    errors.push("Workflow edge requires id.");
    return null;
  }
  if (typeof raw.source !== "string" || typeof raw.target !== "string") {
    errors.push(`Edge ${String(raw.id)} requires source and target.`);
    return null;
  }

  const sourceType = nodeTypeById.get(raw.source);
  const kind = inferEdgeKind(raw, sourceType);

  return {
    id: raw.id,
    source: raw.source,
    target: raw.target,
    kind,
    label: typeof raw.label === "string" ? raw.label : undefined
  };
}

function validateTopology(graph: WorkflowGraph, errors: string[]): void {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, WorkflowEdge[]>();
  const outgoing = new Map<string, WorkflowEdge[]>();

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source)) {
      errors.push(`Edge ${edge.id} source ${edge.source} is missing.`);
    }
    if (!nodeById.has(edge.target)) {
      errors.push(`Edge ${edge.id} target ${edge.target} is missing.`);
    }
    const outs = outgoing.get(edge.source) ?? [];
    outs.push(edge);
    outgoing.set(edge.source, outs);
    const ins = incoming.get(edge.target) ?? [];
    ins.push(edge);
    incoming.set(edge.target, ins);
  }

  const starts = graph.nodes.filter((node) => node.type === "start");
  if (starts.length !== 1) {
    errors.push("Workflow graph requires exactly one start node.");
  }
  if (!graph.nodes.some((node) => node.type === "end" || node.type === "error_end")) {
    errors.push("Workflow graph requires at least one end or error_end node.");
  }

  for (const node of graph.nodes) {
    const outs = outgoing.get(node.id) ?? [];
    const ins = incoming.get(node.id) ?? [];

    if (node.type === "switch") {
      const routes = outs.filter((edge) => edge.kind === "route");
      if (routes.length < 2) {
        errors.push(`Switch ${node.id} requires at least two route edges.`);
      }
      const labels = routes.map((edge) => edge.label ?? "");
      if (new Set(labels).size !== labels.length) {
        errors.push(`Switch ${node.id} route labels must be unique.`);
      }
    }

    if (node.type === "fork") {
      const nexts = outs.filter((edge) => edge.kind === "next");
      if (nexts.length < 2) {
        errors.push(`Fork ${node.id} requires at least two next edges.`);
      }
    }

    if (node.type === "join") {
      const deps = ins.filter((edge) => edge.kind === "depends_on");
      if (deps.length < 2) {
        errors.push(`Join ${node.id} requires at least two depends_on edges.`);
      }
      if (ins.some((edge) => edge.kind !== "depends_on")) {
        errors.push(`Join ${node.id} accepts only depends_on in-edges.`);
      }
    }

    if (node.type === "foreach") {
      if (!node.data.foreach?.itemsFrom || !node.data.foreach.body) {
        errors.push(`Foreach ${node.id} requires foreach.itemsFrom and foreach.body.`);
      }
    }

    if (node.type === "map") {
      if (!node.data.map?.from || !node.data.map.as || !node.data.map.fields?.length) {
        errors.push(`Map ${node.id} requires map.from, map.as, and map.fields.`);
      }
    }

    if (node.type === "subworkflow") {
      if (!node.data.subworkflow?.workflowId) {
        errors.push(`Subworkflow ${node.id} requires subworkflow.workflowId.`);
      }
    }

    if (node.type === "wait") {
      if (!node.data.wait?.delayMs && !node.data.wait?.until) {
        errors.push(`Wait ${node.id} requires wait.delayMs or wait.until.`);
      }
    }

    if (node.data.executionPolicy?.onExhausted === "error_edge") {
      if (!outs.some((edge) => edge.kind === "error")) {
        errors.push(`Node ${node.id} onExhausted=error_edge requires an error edge.`);
      }
    }
  }

  for (const edge of graph.edges) {
    if (edge.kind === "depends_on") {
      const target = nodeById.get(edge.target);
      if (target && target.type !== "join") {
        errors.push(`Edge ${edge.id} depends_on target must be a join.`);
      }
    }
    if (edge.kind === "route") {
      const source = nodeById.get(edge.source);
      if (source && source.type !== "switch" && source.type !== "gate") {
        errors.push(`Edge ${edge.id} route source must be switch or gate.`);
      }
    }
  }

  // Ambiguous multi-next merge into work/control (non-join) nodes is forbidden.
  for (const [targetId, edges] of incoming) {
    const target = nodeById.get(targetId);
    if (!target || target.type === "join") {
      continue;
    }
    const nextIns = edges.filter((edge) => edge.kind === "next");
    if (nextIns.length > 1) {
      errors.push(
        `Node ${targetId} has multiple next in-edges; use a join with depends_on for fan-in.`
      );
    }
  }
}

/** Parse and validate a Workflow Step Graph (v1 migrated or v2). Always returns version 2. */
export function parseWorkflowGraph(raw: unknown): WorkflowParseOutcome {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ["Workflow graph must be an object."] };
  }

  const version = raw.version === undefined ? WORKFLOW_SCHEMA_VERSION : raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    errors.push("Workflow graph.version must be a positive integer.");
  }

  if (!Array.isArray(raw.nodes)) {
    errors.push("Workflow graph.nodes must be an array.");
  }
  if (!Array.isArray(raw.edges)) {
    errors.push("Workflow graph.edges must be an array.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nodes = (raw.nodes as unknown[])
    .map((node) => parseNode(node, errors))
    .filter((node): node is WorkflowNode => node !== null);
  const nodeTypeById = new Map(nodes.map((node) => [node.id, node.type]));
  const edges = (raw.edges as unknown[])
    .map((edge) => parseEdge(edge, errors, nodeTypeById))
    .filter((edge): edge is WorkflowEdge => edge !== null);

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) {
    errors.push("Workflow node ids must be unique.");
  }
  const edgeIds = new Set(edges.map((edge) => edge.id));
  if (edgeIds.size !== edges.length) {
    errors.push("Workflow edge ids must be unique.");
  }

  const graph: WorkflowGraph = {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes,
    edges
  };

  validateTopology(graph, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, graph };
}

export function readWorkflowGraph(metadata: JsonRecord): WorkflowParseOutcome {
  return parseWorkflowGraph(metadata.graph);
}

export function writeWorkflowGraph(metadata: JsonRecord, graph: WorkflowGraph): JsonRecord {
  return {
    ...metadata,
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    graph: {
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: graph.nodes,
      edges: graph.edges
    }
  };
}

export function createContextBag(input: {
  workflowId: string;
  goal: string;
  startNodeId: string;
  runId?: string;
  keys?: Record<string, unknown>;
}): WorkflowContextBag {
  return {
    workflowId: input.workflowId,
    cursor: input.startNodeId,
    goal: input.goal,
    keys: { ...(input.keys ?? {}), goal: input.goal },
    runId: input.runId,
    status: "running",
    frontier: [input.startNodeId]
  };
}

export function parseContextBag(raw: unknown): WorkflowContextBag | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (typeof raw.workflowId !== "string" || typeof raw.goal !== "string") {
    return null;
  }
  if (raw.cursor !== null && typeof raw.cursor !== "string") {
    return null;
  }
  if (!isRecord(raw.keys)) {
    return null;
  }

  return {
    workflowId: raw.workflowId,
    cursor: raw.cursor as string | null,
    goal: raw.goal,
    keys: { ...raw.keys },
    runId: typeof raw.runId === "string" ? raw.runId : undefined,
    status:
      raw.status === "running" ||
      raw.status === "pending_llm" ||
      raw.status === "pending_user" ||
      raw.status === "completed" ||
      raw.status === "failed" ||
      raw.status === "waiting"
        ? raw.status
        : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
    frontier: asStringArray(raw.frontier)
  };
}

export function readContextBag(metadata: JsonRecord): WorkflowContextBag | null {
  return parseContextBag(metadata.contextBag);
}

export function writeContextBag(metadata: JsonRecord, bag: WorkflowContextBag): JsonRecord {
  return {
    ...metadata,
    contextBag: {
      workflowId: bag.workflowId,
      cursor: bag.cursor,
      goal: bag.goal,
      keys: bag.keys,
      ...(bag.runId ? { runId: bag.runId } : {}),
      ...(bag.status ? { status: bag.status } : {}),
      ...(bag.error ? { error: bag.error } : {}),
      ...(bag.frontier ? { frontier: bag.frontier } : {})
    }
  };
}

export function pickBagKeys(bag: WorkflowContextBag, reads: string[] | undefined): Record<string, unknown> {
  if (!reads || reads.length === 0) {
    return {};
  }
  const slice: Record<string, unknown> = {};
  for (const key of reads) {
    if (key in bag.keys) {
      slice[key] = bag.keys[key];
    }
  }
  return slice;
}

export function applyBagWrites(
  bag: WorkflowContextBag,
  writes: string[] | undefined,
  values: Record<string, unknown>
): { ok: true; bag: WorkflowContextBag } | { ok: false; error: string } {
  const declared = writes ?? [];
  for (const key of Object.keys(values)) {
    if (!declared.includes(key)) {
      return { ok: false, error: `Undeclared write key: ${key}` };
    }
  }
  for (const key of declared) {
    if (!(key in values)) {
      return { ok: false, error: `Missing declared write key: ${key}` };
    }
  }

  return {
    ok: true,
    bag: {
      ...bag,
      keys: {
        ...bag.keys,
        ...values
      }
    }
  };
}

export function getNodeWrites(node: WorkflowNode): string[] {
  return node.data.writes ?? node.data.outputs ?? [];
}

export function findStartNode(graph: WorkflowGraph): WorkflowNode | undefined {
  return graph.nodes.find((node) => node.type === "start");
}

export function findNode(graph: WorkflowGraph, nodeId: string): WorkflowNode | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}

export function outgoingEdges(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId);
}

export function incomingEdges(graph: WorkflowGraph, nodeId: string): WorkflowEdge[] {
  return graph.edges.filter((edge) => edge.target === nodeId);
}

export function outgoingByKind(
  graph: WorkflowGraph,
  nodeId: string,
  kind: WorkflowEdgeKind
): WorkflowEdge[] {
  return outgoingEdges(graph, nodeId).filter((edge) => edge.kind === kind);
}

export function resolveNextNodeId(
  graph: WorkflowGraph,
  nodeId: string,
  routeLabel = "default"
): string | null {
  const edges = outgoingEdges(graph, nodeId);
  if (edges.length === 0) {
    return null;
  }

  const routes = edges.filter((edge) => edge.kind === "route");
  if (routes.length > 0) {
    const labeled = routes.find((edge) => (edge.label ?? "default") === routeLabel);
    if (labeled) {
      return labeled.target;
    }
  }

  const nexts = edges.filter((edge) => edge.kind === "next");
  const labeledNext = nexts.find((edge) => (edge.label ?? "default") === routeLabel);
  if (labeledNext) {
    return labeledNext.target;
  }
  return nexts[0]?.target ?? edges.find((edge) => edge.kind !== "depends_on" && edge.kind !== "error")?.target ?? null;
}

/** Soft editor warning: required reads with no upstream declared write. */
export function warnMissingUpstreamKeys(graph: WorkflowGraph): string[] {
  const written = new Set<string>();
  const warnings: string[] = [];
  const start = findStartNode(graph);
  if (!start) {
    return warnings;
  }

  const queue = [start.id];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    const node = findNode(graph, id);
    if (!node) {
      continue;
    }
    for (const key of node.data.reads ?? []) {
      const required = node.data.inputs?.[key]?.required !== false;
      if (required && key !== "goal" && !written.has(key)) {
        warnings.push(`Node ${node.id} requires \`${key}\`, but no upstream node guarantees that key.`);
      }
    }
    for (const key of getNodeWrites(node)) {
      written.add(key);
    }
    for (const edge of outgoingEdges(graph, id)) {
      if (edge.kind === "next" || edge.kind === "route" || edge.kind === "depends_on") {
        queue.push(edge.target);
      }
    }
  }
  return warnings;
}

export function emptyWorkflowGraph(): WorkflowGraph {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      { id: "start", type: "start", position: { x: 80, y: 120 }, data: { title: "Start", writes: ["goal"] } },
      { id: "end", type: "end", position: { x: 420, y: 120 }, data: { title: "End" } }
    ],
    edges: [{ id: "e_start_end", source: "start", target: "end", kind: "next" }]
  };
}

/** Locked Workflow Step Graph example (migrated to v2 edge kinds). */
export const exampleWorkflowGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  edges: [
    { id: "e1", source: "start", target: "load", kind: "next" },
    { id: "e2", source: "load", target: "filter", kind: "next" },
    { id: "e3", source: "filter", target: "choose", kind: "next" },
    { id: "e4", source: "choose", target: "write_aspect", kind: "next" },
    { id: "e5", source: "write_aspect", target: "end", kind: "next" }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 0, y: 0 },
      data: { title: "Start", writes: ["goal"] }
    },
    {
      id: "load",
      type: "context",
      position: { x: 200, y: 0 },
      data: {
        title: "Load candidates",
        reads: ["goal"],
        writes: ["matches"],
        auto: {
          loadContext: {
            limit: 10,
            queryFrom: "goal",
            types: ["aspect", "feature"]
          }
        }
      }
    },
    {
      id: "filter",
      type: "transform",
      position: { x: 400, y: 0 },
      data: {
        title: "Filter keys",
        reads: ["matches"],
        writes: ["filteredEntities"],
        auto: {
          filter: {
            from: "matches",
            keys: ["id", "title", "type", "status"],
            where: { field: "type", op: "in", value: ["aspect", "feature"] }
          }
        }
      }
    },
    {
      id: "choose",
      type: "llm",
      position: { x: 600, y: 0 },
      data: {
        title: "Choose Aspect",
        reads: ["goal", "filteredEntities"],
        writes: ["chosenAspectId", "createNewTitle", "confidence"],
        llm: {
          inputKeys: ["goal", "filteredEntities"],
          instructions:
            "Pick the smallest truthful Aspect id from filteredEntities, or say createNew with a title.",
          outputSchema: ["chosenAspectId", "createNewTitle", "confidence"],
          tools: []
        }
      }
    },
    {
      id: "write_aspect",
      type: "tool",
      position: { x: 800, y: 0 },
      data: {
        title: "Ensure Aspect",
        reads: ["chosenAspectId", "createNewTitle"],
        writes: ["aspectId"],
        tool: {
          name: "create_entity_if_missing",
          argsFromBag: { id: "chosenAspectId", title: "createNewTitle" }
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 1000, y: 0 },
      data: { title: "End" }
    }
  ]
};

/** Pick next eligible task workflow (v2). */
export const newTaskWorkflowGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  edges: [
    { id: "e1", source: "start", target: "load", kind: "next" },
    { id: "e2", source: "load", target: "rank", kind: "next" },
    { id: "e3", source: "rank", target: "gate", kind: "next" },
    { id: "e4", source: "gate", target: "pick", kind: "next", label: "approved" },
    { id: "e5", source: "pick", target: "neighborhood", kind: "next" },
    { id: "e6", source: "neighborhood", target: "prompt", kind: "next" },
    { id: "e7", source: "prompt", target: "llm", kind: "next" },
    { id: "e8", source: "llm", target: "end", kind: "next" }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 0, y: 80 },
      data: { title: "Start", writes: ["goal"] }
    },
    {
      id: "load",
      type: "context",
      position: { x: 180, y: 80 },
      data: {
        title: "Load graph",
        writes: ["entities", "relations"],
        auto: {
          loadContext: {
            mode: "all",
            includeRelations: true
          }
        }
      }
    },
    {
      id: "rank",
      type: "transform",
      position: { x: 360, y: 80 },
      data: {
        title: "Rank candidates",
        reads: ["entities", "relations"],
        writes: ["candidates", "hasCandidates"],
        auto: {
          filter: {
            from: "entities",
            rank: "task_candidates"
          }
        }
      }
    },
    {
      id: "gate",
      type: "gate",
      position: { x: 540, y: 80 },
      data: {
        title: "Any candidates?",
        reads: ["hasCandidates"],
        gate: {
          askUserIf: "!hasCandidates"
        }
      }
    },
    {
      id: "pick",
      type: "transform",
      position: { x: 720, y: 80 },
      data: {
        title: "Pick top task",
        reads: ["candidates"],
        writes: ["selectedTask"],
        auto: {
          assign: {
            pickFirst: { from: "candidates" }
          }
        }
      }
    },
    {
      id: "neighborhood",
      type: "transform",
      position: { x: 900, y: 80 },
      data: {
        title: "Task neighborhood",
        reads: ["selectedTask", "entities", "relations"],
        writes: ["taskContext"],
        auto: {
          assign: {
            neighborhoodOf: {
              of: "selectedTask",
              entitiesFrom: "entities",
              relationsFrom: "relations"
            }
          }
        }
      }
    },
    {
      id: "prompt",
      type: "transform",
      position: { x: 1080, y: 80 },
      data: {
        title: "Compose prompt",
        reads: ["selectedTask", "taskContext"],
        writes: ["agentPrompt"],
        auto: {
          assign: {
            composeTaskPrompt: {
              taskFrom: "selectedTask",
              contextFrom: "taskContext"
            }
          }
        }
      }
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 1260, y: 80 },
      data: {
        title: "Agent handoff",
        reads: ["agentPrompt", "selectedTask"],
        writes: ["ack"],
        llm: {
          inputKeys: ["agentPrompt", "selectedTask"],
          instructions:
            "Execute the selected Projectplaner task using agentPrompt as your full brief. Return ack=true when you have accepted the handoff.",
          outputSchema: ["ack"],
          tools: []
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 1440, y: 80 },
      data: { title: "End" }
    }
  ]
};

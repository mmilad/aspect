import type { JsonRecord } from "../../domain/types";
import {
  asStringArray,
  isPosition,
  isRecord,
  normalizeNodeType,
  parseBaseNodeData,
  pickNodeData
} from "../nodes/_shared/schema";
import {
  WORKFLOW_SCHEMA_VERSION,
  workflowEdgeKinds,
  type WorkflowEdgeKind,
  type WorkflowNode,
  type WorkflowNodeType
} from "../nodes/_shared/types";
import { getNodeModel } from "../nodes/registry";
import type {
  WorkflowContextBag,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowParseOutcome
} from "./types";

const WORKFLOW_EDGE_KIND_SET = new Set<string>(workflowEdgeKinds);
const LEGACY_NODE_TYPES = new Set(["filter"]);

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

  const base = parseBaseNodeData(raw.data, raw.id, errors);
  if (!base) {
    return null;
  }

  const model = getNodeModel(type);
  const rawData = isRecord(raw.data) ? raw.data : {};
  const configPartial = model.parseConfig(rawData, raw.id, errors);
  const data = pickNodeData(base, configPartial, model.configKey);

  // Auto-include map.as in writes when map config is present and writes omit it.
  if (data.map && data.writes && !data.writes.includes(data.map.as)) {
    data.writes = [...data.writes, data.map.as];
  }

  return {
    id: raw.id,
    type,
    position: { x: raw.position.x, y: raw.position.y },
    data
  };
}

export function inferEdgeKind(
  raw: Record<string, unknown>,
  sourceType: WorkflowNodeType | undefined
): WorkflowEdgeKind {
  if (typeof raw.kind === "string" && WORKFLOW_EDGE_KIND_SET.has(raw.kind)) {
    return raw.kind as WorkflowEdgeKind;
  }
  if (sourceType === "switch" || sourceType === "branch" || sourceType === "gate") {
    if (typeof raw.label === "string" && raw.label && raw.label !== "default") {
      return "route";
    }
  }
  return "next";
}

export function parseEdge(
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

export function validateTopology(graph: WorkflowGraph, errors: string[]): void {
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
    const model = getNodeModel(node.type);
    model.validateTopology?.({
      node,
      graph: { nodes: graph.nodes, edges: graph.edges },
      incoming: ins,
      outgoing: outs,
      errors
    });

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
      if (source && source.type !== "switch" && source.type !== "branch" && source.type !== "gate") {
        errors.push(`Edge ${edge.id} route source must be switch, branch, or gate.`);
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

/** Legacy if/else switches (true/false routes only) become branch nodes. */
export function rewriteLegacyBooleanSwitches(graph: WorkflowGraph): void {
  for (const node of graph.nodes) {
    if (node.type !== "switch") {
      continue;
    }
    if (node.data.switch?.cases?.length) {
      continue;
    }
    const routes = graph.edges.filter((edge) => edge.source === node.id && edge.kind === "route");
    if (routes.length < 2) {
      continue;
    }
    const labels = routes.map((edge) => edge.label ?? "default");
    const onlyBool = labels.every((label) => label === "true" || label === "false" || label === "default");
    const hasTrueFalse = labels.includes("true") && labels.includes("false");
    if (!onlyBool || !hasTrueFalse) {
      continue;
    }
    node.type = "branch";
    node.data.branch = { on: node.data.switch?.on };
    delete node.data.switch;
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

  rewriteLegacyBooleanSwitches(graph);

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

/**
 * Resolve a switch/branch route among `route` edges only.
 * Falls back to defaultLabel when the discriminant has no matching label.
 */
export function resolveRouteNextNodeId(
  graph: WorkflowGraph,
  nodeId: string,
  routeLabel: string,
  options?: { defaultLabel?: string }
): string | null {
  const defaultLabel = options?.defaultLabel ?? "default";
  const routes = outgoingByKind(graph, nodeId, "route");
  const exact = routes.find((edge) => (edge.label ?? "default") === routeLabel);
  if (exact) {
    return exact.target;
  }
  const fallback = routes.find((edge) => (edge.label ?? "default") === defaultLabel);
  return fallback?.target ?? null;
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

import type { EntityType, JsonRecord } from "../domain/types";

export const workflowNodeTypes = [
  "start",
  "context",
  "filter",
  "tool",
  "llm",
  "write",
  "gate",
  "end"
] as const;

export type WorkflowNodeType = (typeof workflowNodeTypes)[number];

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowFilterWhere {
  field: string;
  op: "eq" | "in" | "neq";
  value: unknown;
}

export interface WorkflowLoadContextAuto {
  /** Default "query" uses rankedByQuery; "all" loads the full (optionally typed) graph snapshot. */
  mode?: "query" | "all";
  /** Bag key for the search string. Required when mode is "query". */
  queryFrom?: string;
  types?: EntityType[];
  limit?: number;
  /** When true and writes include a relations key, also write compact relations. */
  includeRelations?: boolean;
}

export interface WorkflowFilterAuto {
  from: string;
  keys?: string[];
  where?: WorkflowFilterWhere;
  /** Rank/filter open unblocked tasks from the loaded graph using domain candidacy. */
  rank?: "task_candidates";
}

export interface WorkflowAssignAuto {
  set?: Record<string, unknown>;
  /** Copy bag[from][0] into the first declared write key. */
  pickFirst?: { from: string };
  /** Build 1-hop neighborhood of bag[of] from in-bag entities/relations. */
  neighborhoodOf?: {
    of: string;
    entitiesFrom?: string;
    relationsFrom?: string;
  };
  /** Compose agentPrompt from selected task + neighborhood context. */
  composeTaskPrompt?: {
    taskFrom: string;
    contextFrom: string;
  };
}

export interface WorkflowAutoConfig {
  loadContext?: WorkflowLoadContextAuto;
  filter?: WorkflowFilterAuto;
  assign?: WorkflowAssignAuto;
}

export interface WorkflowToolConfig {
  name: string;
  argsFromBag?: Record<string, string>;
}

export interface WorkflowLlmConfig {
  instructions?: string;
  instructionRef?: string;
  tools?: string[];
  inputKeys?: string[];
  outputSchema?: string[];
}

export interface WorkflowWriteConfig {
  action: "create_entity" | "update_entity";
  argsFromBag?: Record<string, string>;
  defaults?: JsonRecord;
}

export interface WorkflowGateConfig {
  askUserIf?: string;
  stopIf?: string;
  routes?: Record<string, string>;
}

export interface WorkflowNodeData {
  title: string;
  reads?: string[];
  writes?: string[];
  outputs?: string[];
  auto?: WorkflowAutoConfig;
  tool?: WorkflowToolConfig;
  llm?: WorkflowLlmConfig;
  write?: WorkflowWriteConfig;
  gate?: WorkflowGateConfig;
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowPosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowGraph {
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowContextBag {
  workflowId: string;
  cursor: string | null;
  goal: string;
  keys: Record<string, unknown>;
  runId?: string;
  status?: "running" | "pending_llm" | "pending_user" | "completed" | "failed";
  error?: string;
}

export interface WorkflowParseResult {
  ok: true;
  graph: WorkflowGraph;
}

export interface WorkflowParseError {
  ok: false;
  errors: string[];
}

export type WorkflowParseOutcome = WorkflowParseResult | WorkflowParseError;

const WORKFLOW_NODE_TYPE_SET = new Set<string>(workflowNodeTypes);

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

  return {
    ...raw,
    title: raw.title,
    reads,
    writes,
    outputs,
    auto: isRecord(raw.auto) ? (raw.auto as unknown as WorkflowAutoConfig) : undefined,
    tool: isRecord(raw.tool) ? (raw.tool as unknown as WorkflowToolConfig) : undefined,
    llm: isRecord(raw.llm) ? (raw.llm as unknown as WorkflowLlmConfig) : undefined,
    write: isRecord(raw.write) ? (raw.write as unknown as WorkflowWriteConfig) : undefined,
    gate: isRecord(raw.gate) ? (raw.gate as unknown as WorkflowGateConfig) : undefined
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
  if (typeof raw.type !== "string" || !WORKFLOW_NODE_TYPE_SET.has(raw.type)) {
    errors.push(`Node ${raw.id} has invalid type.`);
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
    type: raw.type as WorkflowNodeType,
    position: { x: raw.position.x, y: raw.position.y },
    data
  };
}

function parseEdge(raw: unknown, errors: string[]): WorkflowEdge | null {
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

  return {
    id: raw.id,
    source: raw.source,
    target: raw.target,
    label: typeof raw.label === "string" ? raw.label : undefined
  };
}

/** Parse and validate a Workflow Step Graph v1 payload. */
export function parseWorkflowGraph(raw: unknown): WorkflowParseOutcome {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ["Workflow graph must be an object."] };
  }

  const version = raw.version === undefined ? 1 : raw.version;
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

  const nodes = (raw.nodes as unknown[]).map((node) => parseNode(node, errors)).filter((node): node is WorkflowNode => node !== null);
  const edges = (raw.edges as unknown[]).map((edge) => parseEdge(edge, errors)).filter((edge): edge is WorkflowEdge => edge !== null);

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) {
    errors.push("Workflow node ids must be unique.");
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} source ${edge.source} is missing.`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} target ${edge.target} is missing.`);
    }
  }

  const starts = nodes.filter((node) => node.type === "start");
  if (starts.length !== 1) {
    errors.push("Workflow graph requires exactly one start node.");
  }
  if (!nodes.some((node) => node.type === "end")) {
    errors.push("Workflow graph requires at least one end node.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    graph: {
      version: version as number,
      nodes,
      edges
    }
  };
}

export function readWorkflowGraph(metadata: JsonRecord): WorkflowParseOutcome {
  return parseWorkflowGraph(metadata.graph);
}

export function writeWorkflowGraph(metadata: JsonRecord, graph: WorkflowGraph): JsonRecord {
  return {
    ...metadata,
    graph: {
      version: graph.version,
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
    status: "running"
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
      raw.status === "failed"
        ? raw.status
        : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined
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
      ...(bag.error ? { error: bag.error } : {})
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

export function resolveNextNodeId(
  graph: WorkflowGraph,
  nodeId: string,
  routeLabel = "default"
): string | null {
  const edges = outgoingEdges(graph, nodeId);
  if (edges.length === 0) {
    return null;
  }
  const labeled = edges.find((edge) => (edge.label ?? "default") === routeLabel);
  if (labeled) {
    return labeled.target;
  }
  const unlabeled = edges.find((edge) => !edge.label || edge.label === "default");
  return unlabeled?.target ?? edges[0]?.target ?? null;
}

/** Locked Workflow Step Graph v1 example from the schema reference. */
export const exampleWorkflowGraph: WorkflowGraph = {
  version: 1,
  edges: [
    { id: "e1", source: "start", target: "load" },
    { id: "e2", source: "load", target: "filter" },
    { id: "e3", source: "filter", target: "choose" },
    { id: "e4", source: "choose", target: "write_aspect" },
    { id: "e5", source: "write_aspect", target: "end" }
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
      type: "filter",
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
          instructions: "Pick the smallest truthful Aspect id from filteredEntities, or say createNew with a title.",
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

/** Pick next eligible task: load full graph → rank → neighborhood → agent prompt. */
export const newTaskWorkflowGraph: WorkflowGraph = {
  version: 1,
  edges: [
    { id: "e1", source: "start", target: "load" },
    { id: "e2", source: "load", target: "rank" },
    { id: "e3", source: "rank", target: "gate" },
    { id: "e4", source: "gate", target: "pick" },
    { id: "e5", source: "pick", target: "neighborhood" },
    { id: "e6", source: "neighborhood", target: "prompt" },
    { id: "e7", source: "prompt", target: "llm" },
    { id: "e8", source: "llm", target: "end" }
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
      type: "filter",
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
      type: "filter",
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
      type: "filter",
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
      type: "filter",
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

export function emptyWorkflowGraph(): WorkflowGraph {
  return {
    version: 1,
    nodes: [
      { id: "start", type: "start", position: { x: 80, y: 120 }, data: { title: "Start", writes: ["goal"] } },
      { id: "end", type: "end", position: { x: 420, y: 120 }, data: { title: "End" } }
    ],
    edges: [{ id: "e_start_end", source: "start", target: "end" }]
  };
}

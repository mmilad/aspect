import type { EntityType, JsonRecord } from "../../../domain/types";

/** Workflow Step Graph v2 node types. */
export const workflowControlNodeTypes = [
  "start",
  "end",
  "error_end",
  "branch",
  "switch",
  "fork",
  "join",
  "foreach",
  "gate",
  "wait",
  "subworkflow"
] as const;

export const workflowWorkNodeTypes = ["tool", "llm", "context", "transform", "map", "write"] as const;

/** Canonical v2 palette (filter is accepted on parse and rewritten to transform). */
export const workflowNodeTypes = [...workflowControlNodeTypes, ...workflowWorkNodeTypes] as const;

export type WorkflowControlNodeType = (typeof workflowControlNodeTypes)[number];
export type WorkflowWorkNodeType = (typeof workflowWorkNodeTypes)[number];
export type WorkflowNodeType = (typeof workflowNodeTypes)[number];

export type WorkflowNodeKind = "control" | "work";

/** Legacy v1 type still accepted by the parser. */
export type WorkflowLegacyNodeType = "filter";

export const workflowEdgeKinds = ["next", "route", "depends_on", "error"] as const;
export type WorkflowEdgeKind = (typeof workflowEdgeKinds)[number];

export const workflowRetryOnValues = [
  "timeout",
  "rate_limit",
  "invalid_output",
  "throw",
  "transient"
] as const;
export type WorkflowRetryOn = (typeof workflowRetryOnValues)[number];

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
  mode?: "query" | "all";
  queryFrom?: string;
  types?: EntityType[];
  limit?: number;
  includeRelations?: boolean;
}

export interface WorkflowFilterAuto {
  from: string;
  keys?: string[];
  where?: WorkflowFilterWhere;
  rank?: "task_candidates";
}

export interface WorkflowAssignAuto {
  set?: Record<string, unknown>;
  pickFirst?: { from: string };
  neighborhoodOf?: {
    of: string;
    entitiesFrom?: string;
    relationsFrom?: string;
  };
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
  /** Chat system role; blank/missing → DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT at run. */
  systemPrompt?: string;
  /** Chat user / task instructions (bag templates allowed). */
  instructions?: string;
  instructionRef?: string;
  tools?: string[];
  inputKeys?: string[];
  outputSchema?: string[];
}

export interface WorkflowWriteConfig {
  action: "create_entity" | "update_entity" | "rollup_parent_status";
  argsFromBag?: Record<string, string>;
  defaults?: JsonRecord;
}

export interface WorkflowGateConfig {
  askUserIf?: string;
  stopIf?: string;
  /** @deprecated Prefer branch/switch + route edges. Kept for v1 migration. */
  routes?: Record<string, string>;
}

/** If/else-style binary (or few-arm) route on a bag key — typically true/false. */
export interface WorkflowBranchConfig {
  /** Bag key evaluated to pick a route label (String(value)). */
  on?: string;
}

/**
 * Multi-way switch on a bag discriminant with an explicit default arm.
 * Route edges use `kind: "route"` and `label` matching the discriminant (or defaultLabel).
 */
export interface WorkflowSwitchConfig {
  /** Bag key evaluated to pick a route label. */
  on?: string;
  /** Optional case labels for editor hints. */
  cases?: string[];
  /** Route label when no case matches (default: "default"). */
  defaultLabel?: string;
}

export interface WorkflowJoinMergeConfig {
  strategy?: "object_per_arm" | "prefer_first" | "prefer_last" | "fail_on_conflict";
  as?: string;
  keys?: string[];
}

export interface WorkflowJoinConfig {
  mode?: "all" | "any" | { count: number };
  remaining?: "cancel_remaining" | "ignore_remaining";
  merge?: WorkflowJoinMergeConfig;
}

export interface WorkflowForeachCollectConfig {
  from: string | string[];
  as: string;
}

export interface WorkflowForeachBodySubworkflow {
  type: "subworkflow";
  workflowId: string;
  inputMap?: Record<string, string>;
  outputMap?: Record<string, string>;
}

export interface WorkflowForeachBodySubgraph {
  type: "subgraph";
  entryNodeId: string;
  exitNodeId: string;
}

export interface WorkflowForeachConfig {
  itemsFrom: string;
  itemKey?: string;
  indexKey?: string;
  body: WorkflowForeachBodySubworkflow | WorkflowForeachBodySubgraph;
  concurrency?: number;
  failureMode?: "fail" | "continue";
  collect?: WorkflowForeachCollectConfig;
}

export interface WorkflowWaitConfig {
  /** Delay in milliseconds from activation. */
  delayMs?: number;
  /** Absolute ISO timestamp; wait until this time. */
  until?: string;
}

export interface WorkflowSubworkflowConfig {
  workflowId: string;
  inputMap?: Record<string, string>;
  outputMap?: Record<string, string>;
}

export interface WorkflowMapField {
  /** Path on source item/object, e.g. "title" or "entity.id". */
  from: string;
  /** Output field name. */
  as: string;
}

export interface WorkflowMapConfig {
  from: string;
  as: string;
  mode?: "array" | "object";
  fields: WorkflowMapField[];
}

export interface WorkflowExecutionPolicy {
  timeoutMs?: number;
  retry?: {
    maxAttempts: number;
    backoffMs?: number;
    backoff?: "fixed" | "exponential";
    retryOn?: WorkflowRetryOn[];
  };
  onExhausted?: "error_edge" | "fail_run";
  idempotencyKeyFrom?: string;
  sideEffect?: "unknown" | "idempotent" | "non_idempotent";
}

export interface WorkflowBagKeyContract {
  required?: boolean;
  shape?: BagShape;
}

/** Lightweight bag value shape for editor + slim AI payloads. */
export type BagShape =
  | { kind: "unknown" }
  | { kind: "any" }
  | { kind: "primitive"; type: "string" | "number" | "boolean" | "null" }
  | { kind: "object"; fields: Record<string, BagShape>; ref?: string }
  | { kind: "array"; items: BagShape }
  | { kind: "ref"; ref: string }
  | { kind: "union"; options: BagShape[] };

export const bagShapeCatalogRefs = ["Entity", "EntityRelation", "RankedTaskCandidate", "Json"] as const;
export type BagShapeCatalogRef = (typeof bagShapeCatalogRefs)[number];

export interface WorkflowNodeData {
  title: string;
  reads?: string[];
  writes?: string[];
  /** @deprecated Alias of writes. */
  outputs?: string[];
  inputs?: Record<string, WorkflowBagKeyContract>;
  outputContracts?: Record<string, WorkflowBagKeyContract>;
  /** portId → bag key this step reads from (identity when omitted). */
  inputBindings?: Record<string, string>;
  /** output portId → bag key this step writes to (identity when omitted). */
  writeBindings?: Record<string, string>;
  auto?: WorkflowAutoConfig;
  tool?: WorkflowToolConfig;
  llm?: WorkflowLlmConfig;
  write?: WorkflowWriteConfig;
  gate?: WorkflowGateConfig;
  branch?: WorkflowBranchConfig;
  switch?: WorkflowSwitchConfig;
  join?: WorkflowJoinConfig;
  foreach?: WorkflowForeachConfig;
  map?: WorkflowMapConfig;
  wait?: WorkflowWaitConfig;
  subworkflow?: WorkflowSubworkflowConfig;
  executionPolicy?: WorkflowExecutionPolicy;
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowPosition;
  data: WorkflowNodeData;
}

/** Minimal edge shape for topology maps (avoids importing graph types). */
export type TopologyEdgeRef = {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
};

export type TopologyEdgeMaps = {
  incoming: Map<string, TopologyEdgeRef[]>;
  outgoing: Map<string, TopologyEdgeRef[]>;
};

export const WORKFLOW_SCHEMA_VERSION = 2;

import type { BagShape, WorkflowEdgeKind, WorkflowNode } from "../nodes/_shared/types";

export const workflowVariableRoles = ["input", "output", "local"] as const;
export type WorkflowVariableRole = (typeof workflowVariableRoles)[number];

export interface WorkflowVariable {
  name: string;
  role: WorkflowVariableRole;
  shape: BagShape;
  required?: boolean;
}

export interface WorkflowRunFrame {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  locals: Record<string, unknown>;
  /** Last value per `${nodeId}::${portId}`. */
  pins: Record<string, unknown>;
  /** Write order per pin key — last writer wins when a port has multiple data edges. */
  pinSeq?: Record<string, number>;
  seq?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  kind: WorkflowEdgeKind;
  label?: string;
  sourcePin?: string;
  targetPin?: string;
  /** Visual-only reroute knobs in flow coordinates. Ignored by the runner. */
  waypoints?: Array<{ x: number; y: number }>;
}

export interface WorkflowGraph {
  /** Schema version — normalized to current after parse. */
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Present on pin-variable graphs (v4). Absent on legacy bag graphs. */
  variables?: WorkflowVariable[];
}

export interface WorkflowContextBag {
  workflowId: string;
  cursor: string | null;
  goal: string;
  keys: Record<string, unknown>;
  runId?: string;
  status?: "running" | "pending_llm" | "pending_user" | "completed" | "failed" | "waiting";
  error?: string;
  /** Active frontier token ids when multi-token runtime is used. */
  frontier?: string[];
  /** Pin-variable runtime frame (v4 graphs). */
  frame?: WorkflowRunFrame;
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

import type { WorkflowEdgeKind, WorkflowNode } from "../nodes/_shared/types";

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  kind: WorkflowEdgeKind;
  label?: string;
}

export interface WorkflowGraph {
  /** Schema version — normalized to 2 after parse. */
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
  status?: "running" | "pending_llm" | "pending_user" | "completed" | "failed" | "waiting";
  error?: string;
  /** Active frontier token ids when multi-token runtime is used. */
  frontier?: string[];
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

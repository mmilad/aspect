import type { Entity, EntityRelation } from "../../domain/types";
import type { BagShape } from "../types";
import type { WorkflowContextBag, WorkflowGraph } from "../graph/types";
import type { WorkflowNode } from "../nodes/_shared/types";
import type { WorkflowAdapters } from "./adapters";

export type WorkflowStepKind =
  | "advanced"
  | "pending_llm"
  | "pending_user"
  | "completed"
  | "failed";

export interface WorkflowLlmPending {
  nodeId: string;
  /** System prompt with bag templates already filled (or shared default). */
  systemPrompt: string;
  /** Task instructions with bag templates already filled. */
  instructions: string;
  reads: Record<string, unknown>;
  /** Slim bag shapes for declared reads (AI-friendly). */
  shapes?: Record<string, string>;
  outputSchema: string[];
  /** Typed write contracts (BagShape) for each outputSchema key. */
  outputs?: Record<string, { shape: BagShape; required?: boolean; slim?: string }>;
  tools: string[];
  /** Template fill warnings (unknown/disallowed tokens). */
  warnings?: string[];
}

export interface WorkflowStepResult {
  kind: WorkflowStepKind;
  bag: WorkflowContextBag;
  nodeId: string | null;
  message?: string;
  llm?: WorkflowLlmPending;
}

/** Context passed to per-node `execute` handlers. */
export interface NodeExecuteContext {
  graph: WorkflowGraph;
  node: WorkflowNode;
  bag: WorkflowContextBag;
  adapters: WorkflowAdapters;
  entities: Entity[];
  relations: EntityRelation[];
  llmWrites?: Record<string, unknown>;
  userRoute?: string;
  /** Helpers */
  fail(error: string): WorkflowStepResult;
  advance(routeLabel?: string): Promise<WorkflowStepResult>;
  applyWrites(
    values: Record<string, unknown>
  ): { ok: true; bag: WorkflowContextBag } | { ok: false; error: string };
  read(key: string): unknown;
  getWrites(): string[];
}

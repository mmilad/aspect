import type { Entity, EntityRelation } from "../../domain/types";
import type { WorkflowContextBag, WorkflowGraph } from "../graph/types";
import type { WorkflowAdapters } from "./adapters";
import type { WorkflowStepResult } from "./types";
import { WorkflowRun } from "./workflow";

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
  const run = new WorkflowRun(input);
  return run.step({ llmWrites: input.llmWrites, userRoute: input.userRoute });
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
  const run = new WorkflowRun(input);
  return run.runUntilPause(input.maxSteps);
}

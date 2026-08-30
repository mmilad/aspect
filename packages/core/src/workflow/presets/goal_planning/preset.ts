import type { WorkflowPreset } from "../types";
import { goalPlanningGraph } from "./graph";

export const goalPlanningPreset: WorkflowPreset = {
  presetKey: "goal_planning",
  presetVersion: 3,
  title: "Goal planning",
  summary: "Seed a plan.v1 document, classify the frontier, expand needs_subplan, nest Thinking on needs_decision, halt on budget or blocked work.",
  body: [
    "Inputs: task, optional constraints, context, success, budget, targetTaskId.",
    "Loop: pick frontier → classify (pending_llm) → apply → expand when needs_subplan, Thinking subworkflow when needs_decision → pick.",
    "Routers are switch nodes on route / persistRoute (not boolean branch).",
    "The plan document lives in the bag (legacy keys), so the loop can mutate it without data-edge fan-in.",
    "Thinking is nested (workflowId=thinking); pending_llm bubbles to the parent runId. No drainLlm. No plan workflow node type.",
    "On halt, if targetTaskId is set, seal bag.plan onto a Reference (metadata.kind plan.v1). The Task references that node. Skip persist when targetTaskId is empty.",
    "Output: plan (projectplaner.plan.v1), stop, and optional planEntityId."
  ].join("\n"),
  status: "accepted",
  kind: "builder",
  graph: goalPlanningGraph,
  supportsTargetSlug: "FEAT-15",
  drainLlm: false
};

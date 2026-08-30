import type { WorkflowPreset } from "../types";
import { createWorkflowGraph } from "./graph";

export const createWorkflowPreset: WorkflowPreset = {
  presetKey: "create_workflow",
  presetVersion: 3,
  title: "Create workflow",
  summary:
    "Plan node instructions from a brief, run create_step for each one, then assemble a workflow fragment.",
  body: [
    "Inputs: brief:string plus optional availableBagShape and allowedNodeTypes.",
    "Plan steps LLM writes stepInstructionsList (at least 2 sequential work nodes, unique titles, no start/end, no max count).",
    "Foreach loop pin runs the create_step subworkflow, then pushes stepDraft onto stepDrafts.",
    "Push starts from [] when stepDrafts is empty, so multiple loop iterations accumulate.",
    "Assemble fragment wraps the drafts with start/end, a sequential exec spine, and data wires that chain earlier writes into later reads.",
    "Output: workflowDraft. Persistence and graph-level QA are deferred."
  ].join("\n"),
  status: "accepted",
  kind: "builder",
  graph: createWorkflowGraph,
  supportsTargetSlug: "FEAT-24"
};

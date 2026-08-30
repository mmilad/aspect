import type { WorkflowPreset } from "../types";
import { thinkingGraph } from "./graph";

export const thinkingPreset: WorkflowPreset = {
  presetKey: "thinking",
  presetVersion: 1,
  title: "Thinking",
  summary: "Generic bounded thinking loop for difficult workflow decisions.",
  body: [
    "Inputs: task, optional context, constraints, expectedOutput, capabilities, and maxIterations.",
    "The loop analyzes, generates alternatives, evaluates, decides, validates, and reflects when validation rejects the result.",
    "Cycles are controlled by executionPolicy.maxVisitsFrom=maxIterations on the understand node, with maxVisits=3 as fallback.",
    "Output: result, decision, validation, trace, and iterations. Trace entries are compact semantic audit summaries, not private chain-of-thought."
  ].join("\n"),
  status: "accepted",
  kind: "builder",
  graph: thinkingGraph
};

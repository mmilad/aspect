import type { WorkflowPreset } from "../types";
import { createStepGraph } from "./graph";

export const createStepPreset: WorkflowPreset = {
  presetKey: "create_step",
  presetVersion: 6,
  title: "Create step",
  summary:
    "Pin-variable step builder: interpret instructions, create one workflow node, QA it, and return stepDraft.",
  body: [
    "Inputs: stepInstructions:string plus optional availableBagShape and allowedNodeTypes.",
    "Start data pins fan through reroute knots to interpret, create, verify, and fix.",
    "Output: stepDraft.",
    "Interpret LLM output pin: nodePlan (workflow_node_plan_v1).",
    "Factory output pins: workflowNode, nodeMeta, nodePlanValid, validationErrors, hasValidationErrors, repairInstructions, stepDraft, nodePlan (echo).",
    "Verifier LLM output pins: nodeAccepted, qaReason, repairInstructions, improvements.",
    "Rejected output routes into a dedicated fix-node-plan LLM, then re-runs deterministic creation and verification."
  ].join("\n"),
  status: "accepted",
  kind: "builder",
  graph: createStepGraph,
  supportsTargetSlug: "FEAT-24"
};

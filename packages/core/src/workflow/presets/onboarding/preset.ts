import type { WorkflowPreset } from "../types";
import { onboardingGraph } from "./graph";

export const onboardingPreset: WorkflowPreset = {
  presetKey: "onboarding",
  presetVersion: 2,
  title: "Onboarding",
  summary: "Session orientation rules for agents (workflow-shaped; MCP orient remains the fast path).",
  body: [
    "Stamp orientation rules into bag.orientation.",
    "MCP orient stays available as a fast path; this pack is editable per project.",
    "Prefer Ensure Aspect / CRUD presets over inventing duplicate meaning anchors."
  ].join("\n"),
  status: "accepted",
  kind: "orientation",
  graph: onboardingGraph
};

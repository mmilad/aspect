import type { WorkflowPreset } from "../types";
import { ensureAspectGraph } from "./graph";

export const ensureAspectPreset: WorkflowPreset = {
  presetKey: "ensure_aspect",
  presetVersion: 6,
  title: "Ensure Aspect",
  summary: "Search for a similar Aspect before creating one; reuse when possible.",
  body: [
    "Call this workflow before create_entity for aspects.",
    "Inputs: title (required), summary, key, reason (required for create), parentAspectId (optional).",
    "Outputs: aspectId; createNew indicates whether a row was inserted.",
    "Prefer the smallest truthful existing Aspect; do not duplicate near-matches.",
    "Port contracts + identity inputBindings/writeBindings; aspectId is string|null from the LLM step.",
    "Refresh seeded DB with: pnpm plan presets-ensure --force"
  ].join("\n"),
  status: "accepted",
  kind: "mutation",
  graph: ensureAspectGraph,
  supportsTargetSlug: "should-author-executable-workflow-step-graphs"
};

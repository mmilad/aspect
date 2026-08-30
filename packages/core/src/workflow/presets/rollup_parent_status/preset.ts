import type { WorkflowPreset } from "../types";
import { rollupParentStatusGraph } from "./graph";

export const rollupParentStatusPreset: WorkflowPreset = {
  presetKey: "rollup_parent_status",
  presetVersion: 2,
  title: "Roll up parent status",
  summary:
    "Derive Aspect/Feature process status from first-level process children and recurse upward.",
  body: [
    "Bag: entityId (changed Aspect/Feature/Task), reason (required).",
    "Uses first-level process children only; decisions/questions never update parents.",
    "Incomplete children ⇒ parent at least in_progress; never drops below in_progress once there.",
    "Also invoked automatically after process create and status updates.",
    "Port contracts + identity bindings; refresh DB with pnpm plan presets-ensure --force."
  ].join("\n"),
  status: "accepted",
  kind: "housekeeping",
  graph: rollupParentStatusGraph,
  supportsTargetSlug: "parent-status-rollup-workflow"
};

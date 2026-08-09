import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { WorkflowPreset } from "./types";

/**
 * Roll up parent process status from a changed Aspect/Feature/Task.
 * Decisions and questions never participate.
 */
export const rollupParentStatusGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["entityId", "reason"],
        outputContracts: {
          entityId: { required: true, shape: { kind: "primitive", type: "string" } },
          reason: { required: true, shape: { kind: "primitive", type: "string" } }
        }
      }
    },
    {
      id: "rollup",
      type: "write",
      position: { x: 280, y: 120 },
      data: {
        title: "Roll up parents",
        reads: ["entityId", "reason"],
        writes: ["updatedIds", "derived"],
        write: {
          action: "rollup_parent_status",
          argsFromBag: {
            entityId: "entityId",
            reason: "reason"
          },
          defaults: { resultAs: "updatedIds" }
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 520, y: 120 },
      data: { title: "End" }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "rollup", kind: "next" },
    { id: "e2", source: "rollup", target: "end", kind: "next" }
  ]
};

export const rollupParentStatusPreset: WorkflowPreset = {
  presetKey: "rollup_parent_status",
  presetVersion: 1,
  title: "Roll up parent status",
  summary:
    "Derive Aspect/Feature process status from first-level process children and recurse upward.",
  body: [
    "Bag: entityId (changed Aspect/Feature/Task), reason (required).",
    "Uses first-level process children only; decisions/questions never update parents.",
    "Incomplete children ⇒ parent at least in_progress; never drops below in_progress once there.",
    "Also invoked automatically after process create and status updates."
  ].join("\n"),
  status: "accepted",
  graph: rollupParentStatusGraph,
  supportsTargetSlug: "parent-status-rollup-workflow"
};

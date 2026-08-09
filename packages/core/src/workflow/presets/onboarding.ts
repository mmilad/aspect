import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { WorkflowPreset } from "./types";

const onboardingGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["focus"],
        outputContracts: {
          focus: { required: false, shape: { kind: "primitive", type: "string" } }
        }
      }
    },
    {
      id: "rules",
      type: "transform",
      position: { x: 280, y: 120 },
      data: {
        title: "Stamp orientation rules",
        writes: ["orientation"],
        auto: {
          assign: {
            set: {
              orientation: {
                purpose: "Local graph-first planning store. Aspects are meaning anchors.",
                rules: [
                  "Serialize Projectplaner tool calls.",
                  "Prefer smallest truthful Aspect/Feature before creating anchors.",
                  "Writes require reason.",
                  "Prefer run_workflow presets for create/update/archive when seeded.",
                  "Delete means archive (status=archived), never hard-delete.",
                  "LLM workflow pauses return pending_llm; resume with llmWrites."
                ],
                next: "Call search or next_work / run_workflow key=next_work."
              }
            }
          }
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
    { id: "e1", source: "start", target: "rules", kind: "next" },
    { id: "e2", source: "rules", target: "end", kind: "next" }
  ]
};

export const onboardingPreset: WorkflowPreset = {
  presetKey: "onboarding",
  presetVersion: 1,
  title: "Onboarding",
  summary: "Session orientation rules for agents (workflow-shaped; MCP orient remains the fast path).",
  body: [
    "Stamp orientation rules into bag.orientation.",
    "MCP orient stays available as a fast path; this pack is editable per project.",
    "Prefer Ensure Aspect / CRUD presets over inventing duplicate meaning anchors."
  ].join("\n"),
  status: "accepted",
  graph: onboardingGraph
};

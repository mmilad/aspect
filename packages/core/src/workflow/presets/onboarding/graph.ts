import type { WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { identityBindings } from "../bindings";

const STRING = { kind: "primitive" as const, type: "string" as const };

export const onboardingGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["focus"],
        writeBindings: identityBindings(["focus"]),
        outputContracts: {
          focus: { required: false, shape: STRING }
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
        writeBindings: identityBindings(["orientation"]),
        outputContracts: {
          orientation: { required: true, shape: { kind: "any" } }
        },
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


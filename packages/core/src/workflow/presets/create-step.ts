import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import { identityBindings } from "./bindings";
import type { WorkflowPreset } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };

/**
 * Pilot preset for the "create step" workstream.
 * First slice: prove foreach can expose item/index keys and collect item values
 * back into a renamed parent array.
 */
export const createStepGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["missions"],
        writeBindings: identityBindings(["missions"]),
        outputContracts: {
          missions: { required: true, shape: STRING_ARRAY }
        }
      }
    },
    {
      id: "each_mission",
      type: "foreach",
      position: { x: 280, y: 120 },
      data: {
        title: "Create decisions",
        reads: ["missions"],
        inputs: {
          missions: { required: true, shape: STRING_ARRAY }
        },
        inputBindings: identityBindings(["missions"]),
        writes: ["decisions"],
        writeBindings: identityBindings(["decisions"]),
        outputContracts: {
          decisions: { required: true, shape: STRING_ARRAY }
        },
        foreach: {
          itemsFrom: "missions",
          itemKey: "mission",
          indexKey: "missionIndex",
          body: {
            type: "subgraph",
            entryNodeId: "loop_scope",
            exitNodeId: "loop_scope"
          },
          collect: {
            from: "mission",
            as: "decisions"
          },
          failureMode: "fail"
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
    { id: "e1", source: "start", target: "each_mission", kind: "next" },
    { id: "e2", source: "each_mission", target: "end", kind: "next" }
  ]
};

export const createStepPreset: WorkflowPreset = {
  presetKey: "create_step",
  presetVersion: 1,
  title: "Create step",
  summary:
    "Pilot create-step workflow: foreach over missions and collect decisions with the same text.",
  body: [
    "Bag: missions:string[] required.",
    "Foreach exposes mission:string and missionIndex:number as iteration-local keys.",
    "Collects mission into decisions:string[] to prove loop scope and parent output contracts.",
    "This is the first branch of the create-step builder workstream; later branches can add map, switch, LLM, and tool."
  ].join("\n"),
  status: "accepted",
  graph: createStepGraph
};

import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import { identityBindings } from "./bindings";
import type { WorkflowPreset } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };

/**
 * Pilot preset for the "create step" workstream.
 * First slice: prove foreach can run a scoped body branch and push values
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
      id: "init_decisions",
      type: "transform",
      position: { x: 280, y: 120 },
      data: {
        title: "Initialize decisions",
        writes: ["decisions"],
        writeBindings: identityBindings(["decisions"]),
        outputContracts: {
          decisions: { required: true, shape: STRING_ARRAY }
        },
        auto: {
          assign: {
            set: { decisions: [] }
          }
        }
      }
    },
    {
      id: "each_mission",
      type: "foreach",
      position: { x: 520, y: 120 },
      data: {
        title: "Create decisions",
        reads: ["missions"],
        inputs: {
          missions: { required: true, shape: STRING_ARRAY }
        },
        inputBindings: identityBindings(["missions"]),
        foreach: {
          itemsFrom: "missions",
          itemKey: "mission",
          indexKey: "missionIndex",
          failureMode: "fail"
        }
      }
    },
    {
      id: "push_decision",
      type: "push",
      position: { x: 760, y: 80 },
      data: {
        title: "Push decision",
        reads: ["missions", "missionIndex", "decisions"],
        inputs: {
          missions: { required: true, shape: STRING_ARRAY },
          missionIndex: { required: true, shape: NUMBER },
          decisions: { required: true, shape: STRING_ARRAY }
        },
        inputBindings: identityBindings(["missions", "missionIndex", "decisions"]),
        writes: ["decisions"],
        writeBindings: identityBindings(["decisions"]),
        outputContracts: {
          decisions: { required: true, shape: STRING_ARRAY }
        },
        push: {
          target: "decisions",
          valueFrom: "missions[missionIndex]"
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 1000, y: 120 },
      data: { title: "End" }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "init_decisions", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e2", source: "init_decisions", target: "each_mission", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e3", source: "each_mission", target: "push_decision", kind: "route", label: "body", sourcePin: "body", targetPin: "in" },
    { id: "e4", source: "each_mission", target: "end", kind: "route", label: "completed", sourcePin: "completed", targetPin: "in" }
  ]
};

export const createStepPreset: WorkflowPreset = {
  presetKey: "create_step",
  presetVersion: 1,
  title: "Create step",
  summary:
    "Pilot create-step workflow: foreach over missions and collect decisions with the same text.",
  body: [
    "Bag: missions:string[] required; decisions:string[] starts empty.",
    "Foreach exposes mission:string and missionIndex:number as iteration-local keys.",
    "Push appends missions[missionIndex] into decisions:string[] to prove scoped foreach body execution and explicit bag mutation.",
    "This is the first branch of the create-step builder workstream; later branches can add map, switch, LLM, and tool."
  ].join("\n"),
  status: "accepted",
  graph: createStepGraph
};

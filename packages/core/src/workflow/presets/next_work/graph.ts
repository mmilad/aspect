import type { WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { identityBindings } from "../bindings";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };

export const nextWorkGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["goal", "limit"],
        writeBindings: identityBindings(["goal", "limit"]),
        outputContracts: {
          goal: { required: false, shape: STRING },
          limit: { required: false, shape: NUMBER }
        }
      }
    },
    {
      id: "rank",
      type: "transform",
      position: { x: 280, y: 120 },
      data: {
        title: "Rank task candidates",
        reads: ["goal"],
        inputs: {
          goal: { required: false, shape: STRING }
        },
        inputBindings: identityBindings(["goal"]),
        writes: ["candidates", "hasCandidates"],
        writeBindings: identityBindings(["candidates", "hasCandidates"]),
        auto: {
          filter: {
            from: "entities",
            rank: "task_candidates",
            keys: ["id", "title", "status", "summary", "workScore"]
          }
        },
        outputContracts: {
          candidates: {
            required: true,
            shape: { kind: "array", items: { kind: "ref", ref: "RankedTaskCandidate" } }
          },
          hasCandidates: { required: true, shape: BOOLEAN }
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
    { id: "e1", source: "start", target: "rank", kind: "next" },
    { id: "e2", source: "rank", target: "end", kind: "next" }
  ]
};


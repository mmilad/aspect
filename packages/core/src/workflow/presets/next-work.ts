import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { WorkflowPreset } from "./types";

const nextWorkGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["goal", "limit"],
        outputContracts: {
          goal: { required: false, shape: { kind: "primitive", type: "string" } }
        }
      }
    },
    {
      id: "rank",
      type: "transform",
      position: { x: 280, y: 120 },
      data: {
        title: "Rank task candidates",
        writes: ["candidates", "hasCandidates"],
        auto: {
          filter: {
            from: "entities",
            rank: "task_candidates",
            keys: ["id", "title", "status", "summary", "workScore"]
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
    { id: "e1", source: "start", target: "rank", kind: "next" },
    { id: "e2", source: "rank", target: "end", kind: "next" }
  ]
};

export const nextWorkPreset: WorkflowPreset = {
  presetKey: "next_work",
  presetVersion: 1,
  title: "Next work",
  summary: "Rank eligible open tasks by work score into bag.candidates.",
  body: [
    "Pick the next eligible task candidates from the living graph.",
    "Outputs: candidates[], hasCandidates.",
    "Agents may still call MCP next_work for a ranked pick; this pack is the workflow-shaped equivalent."
  ].join("\n"),
  status: "accepted",
  graph: nextWorkGraph
};

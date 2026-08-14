import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../../schema";
import { createStepGraph } from "../../presets";
import { WorkflowRun } from "../../runtime/workflow";
import type { WorkflowGraph } from "../../types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };
const NUMBER_ARRAY = { kind: "array" as const, items: NUMBER };

function parsed(raw: unknown): WorkflowGraph {
  const result = parseWorkflowGraph(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.graph;
}

describe("foreach execution", () => {
  it("collects a decisions list from missions using iteration-local mission keys", async () => {
    const childGraph = parsed({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            writes: ["mission", "missionIndex"],
            outputContracts: {
              mission: { required: true, shape: STRING },
              missionIndex: { required: true, shape: NUMBER }
            }
          }
        },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [{ id: "e_child", source: "start", target: "end", kind: "next" }]
    });

    const parentGraph = parsed({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            writes: ["missions"],
            outputContracts: {
              missions: { required: true, shape: STRING_ARRAY }
            }
          }
        },
        {
          id: "each_mission",
          type: "foreach",
          position: { x: 180, y: 0 },
          data: {
            title: "Create decisions",
            reads: ["missions"],
            inputs: {
              missions: { required: true, shape: STRING_ARRAY }
            },
            writes: ["decisions"],
            outputContracts: {
              decisions: { required: true, shape: STRING_ARRAY }
            },
            foreach: {
              itemsFrom: "missions",
              itemKey: "mission",
              indexKey: "missionIndex",
              body: {
                type: "subworkflow",
                workflowId: "copy_mission_to_decision",
                outputMap: { decision: "mission" }
              },
              collect: {
                from: "decision",
                as: "decisions"
              },
              failureMode: "fail"
            }
          }
        },
        { id: "end", type: "end", position: { x: 360, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "each_mission", kind: "next" },
        { id: "e2", source: "each_mission", target: "end", kind: "next" }
      ]
    });

    const run = new WorkflowRun({
      graph: parentGraph,
      bag: {
        workflowId: "mission_decisions",
        cursor: "start",
        goal: "copy missions",
        keys: { missions: ["alpha", "beta", "gamma"] },
        status: "running"
      },
      adapters: {
        resolveSubworkflow: (workflowId) =>
          workflowId === "copy_mission_to_decision" ? childGraph : null
      }
    });

    const result = await run.runUntilPause();

    expect(result.kind).toBe("completed");
    expect(result.bag.keys.decisions).toEqual(["alpha", "beta", "gamma"]);
  });

  it("runs the create_step preset foreach pilot", async () => {
    const run = new WorkflowRun({
      graph: createStepGraph,
      bag: {
        workflowId: "create_step",
        cursor: "start",
        goal: "copy missions",
        keys: { missions: ["alpha", "beta", "gamma"] },
        status: "running"
      }
    });

    const result = await run.runUntilPause();

    expect(result.kind).toBe("completed");
    expect(result.bag.keys.decisions).toEqual(["alpha", "beta", "gamma"]);
  });

  it("awaits a scoped body chain for every item", async () => {
    const graph = parsed({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            writes: ["missions", "decisions", "indices"],
            outputContracts: {
              missions: { required: true, shape: STRING_ARRAY },
              decisions: { required: true, shape: STRING_ARRAY },
              indices: { required: true, shape: NUMBER_ARRAY }
            }
          }
        },
        {
          id: "each",
          type: "foreach",
          position: { x: 180, y: 0 },
          data: {
            title: "Each mission",
            foreach: { itemsFrom: "missions", itemKey: "mission", indexKey: "missionIndex" }
          }
        },
        {
          id: "push_decision",
          type: "push",
          position: { x: 360, y: -40 },
          data: {
            title: "Push decision",
            reads: ["missions", "missionIndex", "decisions"],
            writes: ["decisions"],
            push: { target: "decisions", valueFrom: "missions[missionIndex]" }
          }
        },
        {
          id: "push_index",
          type: "push",
          position: { x: 540, y: -40 },
          data: {
            title: "Push index",
            reads: ["missionIndex", "indices"],
            writes: ["indices"],
            push: { target: "indices", valueFrom: "missionIndex" }
          }
        },
        { id: "end", type: "end", position: { x: 360, y: 120 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "each", kind: "next" },
        { id: "e2", source: "each", target: "push_decision", kind: "route", sourcePin: "body", targetPin: "in" },
        { id: "e3", source: "push_decision", target: "push_index", kind: "next" },
        { id: "e4", source: "each", target: "end", kind: "route", sourcePin: "completed", targetPin: "in" }
      ]
    });

    const run = new WorkflowRun({
      graph,
      bag: {
        workflowId: "scoped_body_chain",
        cursor: "start",
        goal: "copy missions",
        keys: { missions: ["alpha", "beta"], decisions: [], indices: [] },
        status: "running"
      }
    });

    const result = await run.runUntilPause();

    expect(result.kind).toBe("completed");
    expect(result.bag.keys.decisions).toEqual(["alpha", "beta"]);
    expect(result.bag.keys.indices).toEqual([0, 1]);
  });

  it("runs nested scoped foreach bodies", async () => {
    const graph = parsed({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: {
            title: "Start",
            writes: ["missions", "suffixes", "decisions"],
            outputContracts: {
              missions: { required: true, shape: STRING_ARRAY },
              suffixes: { required: true, shape: STRING_ARRAY },
              decisions: { required: true, shape: STRING_ARRAY }
            }
          }
        },
        {
          id: "each_mission",
          type: "foreach",
          position: { x: 180, y: 0 },
          data: {
            title: "Each mission",
            foreach: { itemsFrom: "missions", itemKey: "mission", indexKey: "missionIndex" }
          }
        },
        {
          id: "each_suffix",
          type: "foreach",
          position: { x: 360, y: -40 },
          data: {
            title: "Each suffix",
            foreach: { itemsFrom: "suffixes", itemKey: "suffix", indexKey: "suffixIndex" }
          }
        },
        {
          id: "push_suffix",
          type: "push",
          position: { x: 540, y: -40 },
          data: {
            title: "Push suffix",
            reads: ["suffixes", "suffixIndex", "decisions"],
            writes: ["decisions"],
            push: { target: "decisions", valueFrom: "suffixes[suffixIndex]" }
          }
        },
        { id: "end", type: "end", position: { x: 360, y: 120 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "each_mission", kind: "next" },
        { id: "e2", source: "each_mission", target: "each_suffix", kind: "route", sourcePin: "body", targetPin: "in" },
        { id: "e3", source: "each_suffix", target: "push_suffix", kind: "route", sourcePin: "body", targetPin: "in" },
        { id: "e4", source: "each_mission", target: "end", kind: "route", sourcePin: "completed", targetPin: "in" }
      ]
    });

    const run = new WorkflowRun({
      graph,
      bag: {
        workflowId: "nested_scoped_body",
        cursor: "start",
        goal: "nested loop",
        keys: { missions: ["m1", "m2"], suffixes: ["a", "b"], decisions: [] },
        status: "running"
      }
    });

    const result = await run.runUntilPause();

    expect(result.kind).toBe("completed");
    expect(result.bag.keys.decisions).toEqual(["a", "b", "a", "b"]);
  });

  it("rejects new foreach graphs without a body edge", () => {
    const result = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["missions"] } },
        {
          id: "each",
          type: "foreach",
          position: { x: 180, y: 0 },
          data: {
            title: "Each mission",
            foreach: { itemsFrom: "missions", itemKey: "mission", indexKey: "missionIndex" }
          }
        },
        { id: "end", type: "end", position: { x: 360, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "each", kind: "next" },
        { id: "e2", source: "each", target: "end", kind: "route", sourcePin: "completed", targetPin: "in" }
      ]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.includes("body exec output"))).toBe(true);
    }
  });
});

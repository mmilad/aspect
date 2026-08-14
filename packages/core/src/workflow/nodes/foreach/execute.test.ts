import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../../schema";
import { createStepGraph } from "../../presets";
import { WorkflowRun } from "../../runtime/workflow";
import type { WorkflowGraph } from "../../types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };

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
});

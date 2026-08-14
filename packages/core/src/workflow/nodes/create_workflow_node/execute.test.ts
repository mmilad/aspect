import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../../schema";
import { WorkflowRun } from "../../runtime/workflow";
import type { WorkflowGraph, WorkflowNodeType } from "../../types";
import { workflowNodeTypes } from "../_shared/types";

const JSON_SHAPE = { kind: "any" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
const STRING = { kind: "primitive" as const, type: "string" as const };

function parsed(raw: unknown): WorkflowGraph {
  const result = parseWorkflowGraph(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.graph;
}

function factoryGraph(): WorkflowGraph {
  return parsed({
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 0, y: 0 },
        data: {
          title: "Start",
          writes: ["nodePlan"],
          outputContracts: {
            nodePlan: { required: true, shape: JSON_SHAPE }
          }
        }
      },
      {
        id: "factory",
        type: "create_workflow_node",
        position: { x: 200, y: 0 },
        data: {
          title: "Create workflow node",
          reads: ["nodePlan"],
          inputs: {
            nodePlan: { required: true, shape: JSON_SHAPE }
          },
          writes: [
            "workflowNode",
            "nodeMeta",
            "validationErrors",
            "hasValidationErrors",
            "repairInstructions",
            "stepDraft"
          ],
          outputContracts: {
            workflowNode: { required: false, shape: JSON_SHAPE },
            nodeMeta: { required: true, shape: JSON_SHAPE },
            validationErrors: { required: true, shape: JSON_SHAPE },
            hasValidationErrors: { required: true, shape: BOOLEAN },
            repairInstructions: { required: true, shape: STRING },
            stepDraft: { required: true, shape: JSON_SHAPE }
          },
          createWorkflowNode: {
            planFrom: "nodePlan",
            outputKey: "workflowNode",
            metaKey: "nodeMeta",
            errorsKey: "validationErrors",
            hasErrorsKey: "hasValidationErrors",
            repairInstructionsKey: "repairInstructions",
            stepDraftKey: "stepDraft"
          }
        }
      },
      { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      { id: "e1", source: "start", target: "factory", kind: "next" },
      { id: "e2", source: "factory", target: "end", kind: "next" }
    ]
  });
}

async function runFactory(nodePlan: unknown) {
  const run = new WorkflowRun({
    graph: factoryGraph(),
    bag: {
      workflowId: "factory_test",
      cursor: "start",
      goal: "create node",
      keys: { nodePlan },
      status: "running"
    }
  });
  const result = await run.runUntilPause();
  expect(result.kind).toBe("completed");
  return result.bag.keys;
}

function configForType(type: WorkflowNodeType): Record<string, unknown> {
  switch (type) {
    case "branch":
      return { on: "flag" };
    case "switch":
      return { on: "kind", cases: ["a"], defaultLabel: "default" };
    case "join":
      return { mode: "all" };
    case "foreach":
      return { itemsFrom: "items", itemKey: "item", indexKey: "itemIndex" };
    case "wait":
      return { delayMs: 0 };
    case "subworkflow":
      return { workflowId: "child" };
    case "tool":
      return { name: "noop" };
    case "llm":
      return { instructions: "Respond with JSON." };
    case "context":
    case "transform":
      return {};
    case "map":
      return { from: "items", as: "mapped", fields: [{ from: "title", as: "title" }] };
    case "write":
      return { action: "rollup_parent_status" };
    case "push":
      return { target: "items", valueFrom: "item" };
    case "create_workflow_node":
      return { planFrom: "nodePlan" };
    default:
      return {};
  }
}

describe("create_workflow_node execution", () => {
  it("creates a valid foreach node from a node plan", async () => {
    const keys = await runFactory({
      nodeType: "foreach",
      title: "Each mission",
      purpose: "Iterate over missions.",
      reads: ["missions"],
      config: {
        itemsFrom: "missions",
        itemKey: "mission",
        indexKey: "missionIndex"
      }
    });

    expect(keys.hasValidationErrors).toBe(false);
    expect(keys.validationErrors).toEqual([]);
    expect(keys.workflowNode).toMatchObject({
      id: "each_mission",
      type: "foreach",
      data: {
        title: "Each mission",
        reads: ["missions"],
        foreach: {
          itemsFrom: "missions",
          itemKey: "mission",
          indexKey: "missionIndex"
        }
      }
    });
    expect(keys.nodeMeta).toMatchObject({
      nodeType: "foreach",
      execInputs: ["in"],
      execOutputs: ["body", "completed"],
      dataInputs: ["missions"]
    });
    expect(keys.stepDraft).toMatchObject({
      nodes: [{ type: "foreach" }],
      validation: { ok: true, errors: [] }
    });
  });

  it("creates a valid push node from a node plan", async () => {
    const keys = await runFactory({
      nodeType: "push",
      title: "Push decision",
      reads: ["missions", "missionIndex", "decisions"],
      writes: ["decisions"],
      config: {
        target: "decisions",
        valueFrom: "missions[missionIndex]"
      }
    });

    expect(keys.hasValidationErrors).toBe(false);
    expect(keys.workflowNode).toMatchObject({
      id: "push_decision",
      type: "push",
      data: {
        reads: ["missions", "missionIndex", "decisions"],
        writes: ["decisions"],
        push: {
          target: "decisions",
          valueFrom: "missions[missionIndex]"
        }
      }
    });
    expect(keys.nodeMeta).toMatchObject({
      nodeType: "push",
      execInputs: ["in"],
      execOutputs: ["then"],
      dataInputs: ["decisions", "missions[missionIndex]"],
      dataOutputs: ["decisions"]
    });
  });

  it("normalizes default data for every registered node type", async () => {
    for (const nodeType of workflowNodeTypes) {
      const keys = await runFactory({
        nodeType,
        title: `${nodeType} node`,
        config: configForType(nodeType)
      });

      expect(keys.hasValidationErrors, `${nodeType} should be creatable`).toBe(false);
      expect(keys.workflowNode).toMatchObject({
        type: nodeType,
        data: { title: `${nodeType} node` }
      });
    }
  });

  it("rejects unknown node types with structured validation errors", async () => {
    const keys = await runFactory({
      nodeType: "magic",
      title: "Magic node",
      config: {}
    });

    expect(keys.workflowNode).toBeNull();
    expect(keys.hasValidationErrors).toBe(true);
    expect(keys.validationErrors).toEqual(["Unknown workflow node type: magic."]);
    expect(keys.repairInstructions).toContain("Unknown workflow node type");
    expect(keys.stepDraft).toEqual({
      nodes: [],
      validation: { ok: false, errors: ["Unknown workflow node type: magic."] }
    });
  });

  it("rejects invalid type-specific config with structured validation errors", async () => {
    const keys = await runFactory({
      nodeType: "foreach",
      title: "Broken loop",
      config: {}
    });

    expect(keys.workflowNode).toBeNull();
    expect(keys.hasValidationErrors).toBe(true);
    expect(keys.validationErrors).toEqual(["Node broken_loop foreach.itemsFrom is required."]);
    expect(keys.repairInstructions).toContain("foreach.itemsFrom is required");
  });
});

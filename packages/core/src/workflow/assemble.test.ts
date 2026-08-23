import { describe, expect, it } from "vitest";
import { assembleFromStepDrafts, assembleWorkflowFragment } from "./assemble";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "./schema";
import { WorkflowRun } from "./runtime/workflow";
import type { WorkflowGraph, WorkflowNode } from "./types";

const JSON_SHAPE = { kind: "any" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
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
          inputs: { nodePlan: { required: true, shape: JSON_SHAPE } },
          outputContracts: {
            workflowNode: { required: false, shape: JSON_SHAPE },
            nodeMeta: { required: true, shape: JSON_SHAPE },
            validationErrors: { required: true, shape: JSON_SHAPE },
            nodePlanValid: { required: true, shape: BOOLEAN },
            hasValidationErrors: { required: true, shape: BOOLEAN },
            repairInstructions: { required: true, shape: STRING },
            stepDraft: { required: true, shape: JSON_SHAPE }
          },
          createWorkflowNode: {
            planFrom: "nodePlan",
            outputKey: "workflowNode",
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

/** Materialize a known-good nodePlan the same way create_step's factory does. */
async function materialize(nodePlan: unknown): Promise<WorkflowNode> {
  const run = new WorkflowRun({
    graph: factoryGraph(),
    bag: {
      workflowId: "factory_fixture",
      cursor: "start",
      goal: "fixture",
      keys: { nodePlan },
      status: "running"
    }
  });
  const result = await run.runUntilPause();
  expect(result.kind).toBe("completed");
  expect(result.bag.keys.nodePlanValid).toBe(true);
  return result.bag.keys.workflowNode as WorkflowNode;
}

/** Captured create_step math plan (canned llmWrites that already passed factory + QA). */
const MATH_NODE_PLAN = {
  nodeType: "math",
  title: "Divide by two",
  purpose: "Divide the current value by two and expose the result as dividedByTwo.",
  reads: ["currentValue"],
  writes: ["dividedByTwo"],
  inputs: { value: { required: true, shape: NUMBER } },
  outputContracts: { result: { required: true, shape: NUMBER } },
  inputBindings: { value: "currentValue" },
  writeBindings: { result: "dividedByTwo" },
  config: { operation: "divide", operand: 2 }
};

/** Captured llama3/factory foreach plan from the missions→decisions run. */
const FOREACH_NODE_PLAN = {
  nodeType: "foreach",
  title: "Missions Loop",
  purpose: "Iterate over missions.",
  reads: ["missions"],
  config: { itemsFrom: "missions", itemKey: "mission", indexKey: "missionIndex" }
};

const PUSH_NODE_PLAN = {
  nodeType: "push",
  title: "Push decision",
  reads: ["missions", "missionIndex", "decisions"],
  writes: ["decisions"],
  config: { target: "decisions", valueFrom: "missions[missionIndex]" }
};

describe("assembleWorkflowFragment", () => {
  it("wires a math stepDraft with an explicit plan and no LLM", async () => {
    const math = await materialize(MATH_NODE_PLAN);
    const start: WorkflowNode = {
      id: "start",
      type: "start",
      position: { x: 0, y: 0 },
      data: {
        title: "Start",
        outputContracts: {
          currentValue: { required: true, shape: NUMBER }
        }
      }
    };
    const end: WorkflowNode = {
      id: "end",
      type: "end",
      position: { x: 400, y: 0 },
      data: {
        title: "End",
        inputs: {
          dividedByTwo: { required: true, shape: NUMBER }
        }
      }
    };

    const assembled = assembleWorkflowFragment({
      nodes: [start, math, end],
      entryNodeId: "start",
      exitNodeIds: ["end"],
      positions: {
        start: { x: 0, y: 0 },
        [math.id]: { x: 200, y: 0 },
        end: { x: 400, y: 0 }
      },
      edges: [
        { source: "start", target: math.id, kind: "next" },
        { source: math.id, target: "end", kind: "next" },
        {
          source: "start",
          sourcePin: "currentValue",
          target: math.id,
          targetPin: "value",
          kind: "data"
        },
        {
          source: math.id,
          sourcePin: "result",
          target: "end",
          targetPin: "dividedByTwo",
          kind: "data"
        }
      ]
    });

    expect(assembled.ok).toBe(true);
    if (!assembled.ok) {
      throw new Error(assembled.errors.join("\n"));
    }
    expect(assembled.fragment.entryNodeId).toBe("start");
    expect(assembled.fragment.exitNodeIds).toEqual(["end"]);
    expect(assembled.fragment.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "start", target: math.id, kind: "next" }),
        expect.objectContaining({
          source: "start",
          target: math.id,
          kind: "data",
          sourcePin: "currentValue",
          targetPin: "value"
        }),
        expect.objectContaining({
          source: math.id,
          target: "end",
          kind: "data",
          sourcePin: "result",
          targetPin: "dividedByTwo"
        })
      ])
    );
  });

  it("wires captured foreach + push drafts onto the body/completed pins", async () => {
    const loop = await materialize(FOREACH_NODE_PLAN);
    const push = await materialize(PUSH_NODE_PLAN);
    const start: WorkflowNode = {
      id: "start",
      type: "start",
      position: { x: 0, y: 0 },
      data: {
        title: "Start",
        outputContracts: {
          missions: { required: true, shape: STRING_ARRAY },
          decisions: { required: true, shape: STRING_ARRAY }
        }
      }
    };
    const end: WorkflowNode = {
      id: "end",
      type: "end",
      position: { x: 0, y: 120 },
      data: { title: "End" }
    };

    const assembled = assembleWorkflowFragment({
      nodes: [start, loop, push, end],
      entryNodeId: "start",
      exitNodeIds: ["end"],
      edges: [
        { source: "start", target: loop.id, kind: "next" },
        {
          source: loop.id,
          target: push.id,
          kind: "route",
          sourcePin: "body",
          targetPin: "in",
          label: "body"
        },
        {
          source: loop.id,
          target: "end",
          kind: "route",
          sourcePin: "completed",
          targetPin: "in",
          label: "completed"
        },
        {
          source: "start",
          sourcePin: "missions",
          target: loop.id,
          targetPin: "missions",
          kind: "data"
        },
        {
          source: "start",
          sourcePin: "decisions",
          target: push.id,
          targetPin: "decisions",
          kind: "data"
        },
        {
          source: loop.id,
          sourcePin: "missionIndex",
          target: push.id,
          targetPin: "missions[missionIndex]",
          kind: "data"
        }
      ]
    });

    expect(assembled.ok).toBe(true);
    if (!assembled.ok) {
      throw new Error(assembled.errors.join("\n"));
    }
    expect(assembled.fragment.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: loop.id,
          target: push.id,
          kind: "route",
          sourcePin: "body"
        }),
        expect.objectContaining({
          source: loop.id,
          target: "end",
          kind: "route",
          sourcePin: "completed"
        }),
        expect.objectContaining({
          kind: "data",
          sourcePin: "missions",
          targetPin: "missions"
        })
      ])
    );
  });

  it("does not invent nodes and does not call an LLM", async () => {
    const math = await materialize(MATH_NODE_PLAN);
    const assembled = assembleWorkflowFragment({
      nodes: [math],
      entryNodeId: math.id,
      exitNodeIds: [math.id],
      edges: [{ source: math.id, target: "end", kind: "next" }]
    });

    expect(assembled.ok).toBe(false);
    if (assembled.ok) {
      return;
    }
    expect(assembled.errors.some((error) => error.includes("end"))).toBe(true);
  });
});

describe("assembleFromStepDrafts", () => {
  it("wraps a math stepDraft with start/end and sequential wiring", async () => {
    const math = await materialize(MATH_NODE_PLAN);
    const assembled = assembleFromStepDrafts([
      {
        nodes: [math],
        wiringHints: [
          {
            inputBindings: { value: "currentValue" },
            writeBindings: { result: "dividedByTwo" }
          }
        ],
        validation: { ok: true, errors: [] }
      }
    ]);

    expect(assembled.ok).toBe(true);
    if (!assembled.ok) {
      throw new Error(assembled.errors.join("\n"));
    }
    expect(assembled.graph.nodes.map((node) => node.type)).toEqual(["start", "math", "end"]);
    expect(assembled.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "start", target: math.id, kind: "next" }),
        expect.objectContaining({
          kind: "data",
          sourcePin: "currentValue",
          targetPin: "value"
        }),
        expect.objectContaining({
          kind: "data",
          sourcePin: "result",
          targetPin: "dividedByTwo"
        })
      ])
    );
  });

  it("wires a later step's read to the previous writer instead of start", async () => {
    const divide = await materialize(MATH_NODE_PLAN);
    const multiply = await materialize({
      ...MATH_NODE_PLAN,
      title: "Multiply by three",
      purpose: "Multiply dividedByTwo by three and expose the result as timesThree.",
      reads: ["dividedByTwo"],
      writes: ["timesThree"],
      inputBindings: { value: "dividedByTwo" },
      writeBindings: { result: "timesThree" },
      config: { operation: "multiply", operand: 3 }
    });
    const assembled = assembleFromStepDrafts([
      { nodes: [divide], validation: { ok: true, errors: [] } },
      { nodes: [multiply], validation: { ok: true, errors: [] } }
    ]);

    expect(assembled.ok).toBe(true);
    if (!assembled.ok) {
      throw new Error(assembled.errors.join("\n"));
    }
    expect(assembled.graph.nodes.map((node) => node.type)).toEqual(["start", "math", "math", "end"]);
    expect(assembled.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "data",
          source: "start",
          target: divide.id,
          sourcePin: "currentValue",
          targetPin: "value"
        }),
        expect.objectContaining({
          kind: "data",
          source: divide.id,
          target: multiply.id,
          sourcePin: "result",
          targetPin: "value"
        }),
        expect.objectContaining({
          kind: "data",
          source: multiply.id,
          target: "end",
          sourcePin: "result",
          targetPin: "timesThree"
        })
      ])
    );
    expect(assembled.graph.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "data",
          source: "start",
          target: multiply.id
        })
      ])
    );
  });

  it("rejects duplicate work-node titles", async () => {
    const first = await materialize(MATH_NODE_PLAN);
    const second = await materialize(MATH_NODE_PLAN);
    const assembled = assembleFromStepDrafts([
      { nodes: [first], validation: { ok: true, errors: [] } },
      { nodes: [second], validation: { ok: true, errors: [] } }
    ]);
    expect(assembled.ok).toBe(false);
    if (assembled.ok) {
      return;
    }
    expect(assembled.errors.some((error) => error.includes("Duplicate node title"))).toBe(true);
  });
});

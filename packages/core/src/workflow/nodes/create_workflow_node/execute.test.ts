import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, type WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION, type WorkflowNodeType } from "../../nodes";
import { WorkflowRun } from "../../runtime";
import { workflowNodeTypes } from "../_shared/types";

const JSON_SHAPE = { kind: "any" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };

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
          writes: ["nodePlan", "allowedNodeTypes", "availableBagShape"],
          outputContracts: {
            nodePlan: { required: true, shape: JSON_SHAPE },
            allowedNodeTypes: { required: false, shape: JSON_SHAPE },
            availableBagShape: { required: false, shape: JSON_SHAPE }
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
            nodePlan: { required: true, shape: JSON_SHAPE },
            allowedNodeTypes: { required: false, shape: JSON_SHAPE },
            availableBagShape: { required: false, shape: JSON_SHAPE }
          },
          writes: [
            "workflowNode",
            "nodeMeta",
            "validationErrors",
            "nodePlanValid",
            "hasValidationErrors",
            "repairInstructions",
            "stepDraft"
          ],
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
            allowedNodeTypesFrom: "allowedNodeTypes",
            availableBagShapeFrom: "availableBagShape",
            outputKey: "workflowNode",
            metaKey: "nodeMeta",
            errorsKey: "validationErrors",
            validKey: "nodePlanValid",
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

async function runFactory(
  nodePlan: unknown,
  keys: Record<string, unknown> = {}
) {
  const run = new WorkflowRun({
    graph: factoryGraph(),
    bag: {
      workflowId: "factory_test",
      cursor: "start",
      goal: "create node",
      keys: { nodePlan, ...keys },
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
    case "math":
      return { operation: "add", operand: 1 };
    case "write":
      return { action: "rollup_parent_status" };
    case "push":
      return { target: "items", valueFrom: "item" };
    case "create_workflow_node":
      return { planFrom: "nodePlan" };
    case "assemble_fragment":
      return { draftsFrom: "stepDrafts" };
    case "get":
    case "set":
      return { variable: "scratch" };
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
    expect(keys.nodePlanValid).toBe(true);
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
      execOutputs: ["body", "loop", "completed"],
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
    expect(keys.nodePlanValid).toBe(true);
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
      expect(keys.nodePlanValid, `${nodeType} should be valid`).toBe(true);
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
    expect(keys.nodePlanValid).toBe(false);
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
    expect(keys.nodePlanValid).toBe(false);
    expect(keys.hasValidationErrors).toBe(true);
    expect(keys.validationErrors).toEqual(["Node broken_loop foreach.itemsFrom is required."]);
    expect(keys.repairInstructions).toContain("foreach.itemsFrom is required");
  });

  it("rejects a node type outside allowedNodeTypes", async () => {
    const keys = await runFactory(
      {
        nodeType: "push",
        title: "Push decision",
        config: { target: "decisions", valueFrom: "mission" }
      },
      { allowedNodeTypes: ["foreach"] }
    );

    expect(keys.workflowNode).toBeNull();
    expect(keys.nodePlanValid).toBe(false);
    expect(keys.validationErrors).toEqual(["nodePlan.nodeType 'push' is not allowed."]);
  });

  it("rejects config references outside the available bag shape", async () => {
    const keys = await runFactory(
      {
        nodeType: "foreach",
        title: "Each mission",
        reads: ["missionz"],
        config: { itemsFrom: "missionz", itemKey: "mission", indexKey: "missionIndex" }
      },
      { availableBagShape: { missions: "string[]" } }
    );

    expect(keys.workflowNode).toBeNull();
    expect(keys.nodePlanValid).toBe(false);
    expect(keys.validationErrors).toEqual([
      "nodePlan.reads references unavailable bag key 'missionz'.",
      "nodePlan.config.foreach.itemsFrom references unavailable bag key 'missionz'."
    ]);
  });

  it("rejects a math plan that omits pin bindings when a bag shape is provided", async () => {
    const keys = await runFactory(
      {
        nodeType: "math",
        title: "Divide by 2",
        config: { operation: "divide", operand: 2 }
      },
      { availableBagShape: { currentValue: "number" } }
    );

    expect(keys.workflowNode).toBeNull();
    expect(keys.nodePlanValid).toBe(false);
    expect(keys.validationErrors).toEqual(
      expect.arrayContaining([
        "nodePlan.inputBindings.value is required for data input pin 'value'.",
        "nodePlan.writeBindings.result is required for data output pin 'result'."
      ])
    );
    expect(keys.repairInstructions).toContain("inputBindings.value");
  });

  it("accepts a math plan with registry pins, bindings, and matching shapes", async () => {
    const keys = await runFactory(
      {
        nodeType: "math",
        title: "Divide by two",
        reads: ["currentValue"],
        writes: ["dividedByTwo"],
        inputs: { value: { required: true, shape: NUMBER } },
        outputContracts: { result: { required: true, shape: NUMBER } },
        inputBindings: { value: "currentValue" },
        writeBindings: { result: "dividedByTwo" },
        config: { operation: "divide", operand: 2 }
      },
      { availableBagShape: { currentValue: "number" } }
    );

    expect(keys.nodePlanValid).toBe(true);
    expect(keys.stepDraft).toMatchObject({
      wiringHints: [
        {
          inputBindings: { value: "currentValue" },
          writeBindings: { result: "dividedByTwo" }
        }
      ]
    });
  });

  it("remaps bag-key-as-pin math bindings onto value/result", async () => {
    const keys = await runFactory({
      nodeType: "math",
      title: "TripleHalvedValue",
      config: { operation: "multiply", operand: 3 },
      outputContracts: { tripledValue: { type: "number" } },
      inputBindings: { halvedValue: "halvedValue" },
      writeBindings: { tripledValue: "tripledValue" }
    });

    expect(keys.nodePlanValid).toBe(true);
    expect(keys.workflowNode).toMatchObject({
      type: "math",
      data: {
        outputContracts: { result: { required: true, shape: NUMBER } },
        inputBindings: { value: "halvedValue" },
        writeBindings: { result: "tripledValue" }
      }
    });
    expect(keys.stepDraft).toMatchObject({
      wiringHints: [
        {
          inputBindings: { value: "halvedValue" },
          writeBindings: { result: "tripledValue" }
        }
      ]
    });
  });

  it("infers unique math pin bindings from reads and writes", async () => {
    const keys = await runFactory({
      nodeType: "math",
      title: "HalveCurrentValue",
      reads: ["currentValue"],
      writes: ["halvedValue"],
      config: { operation: "divide", operand: 2 }
    });

    expect(keys.nodePlanValid).toBe(true);
    expect(keys.stepDraft).toMatchObject({
      wiringHints: [
        {
          inputBindings: { value: "currentValue" },
          writeBindings: { result: "halvedValue" }
        }
      ]
    });
  });

  it("rejects a math binding whose bag shape does not match the pin", async () => {
    const keys = await runFactory(
      {
        nodeType: "math",
        title: "Divide by two",
        inputBindings: { value: "title" },
        writeBindings: { result: "dividedByTwo" },
        config: { operation: "divide", operand: 2 }
      },
      { availableBagShape: { title: "string" } }
    );

    expect(keys.nodePlanValid).toBe(false);
    expect(keys.validationErrors).toEqual([
      "nodePlan.inputBindings.value shape string is not assignable to pin 'value' (number)."
    ]);
  });

  it("rejects bindings that do not name data pins on the selected node type", async () => {
    const keys = await runFactory({
      nodeType: "llm",
      title: "Writer",
      config: { instructions: "Return JSON." },
      inputBindings: { goal: "goal" }
    });

    expect(keys.nodePlanValid).toBe(false);
    expect(keys.validationErrors).toEqual([
      "nodePlan.inputBindings.goal is not a data input pin on llm."
    ]);
  });

  it("accepts foreach when the items pin matches an available bag key", async () => {
    const keys = await runFactory(
      {
        nodeType: "foreach",
        title: "Each mission",
        reads: ["missions"],
        config: { itemsFrom: "missions", itemKey: "mission", indexKey: "missionIndex" }
      },
      { availableBagShape: { missions: "string[]", decisions: "string[]" } }
    );

    expect(keys.nodePlanValid).toBe(true);
  });

  it("requires push bindings for indexed value pins when a bag shape is provided", async () => {
    const keys = await runFactory(
      {
        nodeType: "push",
        title: "Push decision",
        config: { target: "decisions", valueFrom: "missions[missionIndex]" }
      },
      { availableBagShape: { missions: "string[]", decisions: "string[]" } }
    );

    expect(keys.nodePlanValid).toBe(false);
    expect(keys.validationErrors).toEqual([
      "nodePlan.inputBindings.missions[missionIndex] is required for data input pin 'missions[missionIndex]'."
    ]);
  });

  it("accepts a branch plan that binds condition to an available flag", async () => {
    const keys = await runFactory(
      {
        nodeType: "branch",
        title: "Has flag",
        config: { on: "flag" },
        inputBindings: { condition: "flag" }
      },
      { availableBagShape: { flag: "boolean" } }
    );

    expect(keys.nodePlanValid).toBe(true);
    expect(keys.stepDraft).toMatchObject({
      wiringHints: [{ inputBindings: { condition: "flag" } }]
    });
  });

  it("accepts switch when config.on is an available bag key", async () => {
    const keys = await runFactory(
      {
        nodeType: "switch",
        title: "By kind",
        config: { on: "kind", cases: ["a"], defaultLabel: "default" }
      },
      { availableBagShape: { kind: "string" } }
    );

    expect(keys.nodePlanValid).toBe(true);
  });

  it("accepts map when config.from is an available bag key", async () => {
    const keys = await runFactory(
      {
        nodeType: "map",
        title: "Project titles",
        config: { from: "items", as: "mapped", fields: [{ from: "title", as: "title" }] }
      },
      { availableBagShape: { items: "object[]" } }
    );

    expect(keys.nodePlanValid).toBe(true);
  });

  it("accepts llm and tool plans that bind declared input pins", async () => {
    const llm = await runFactory(
      {
        nodeType: "llm",
        title: "Draft",
        inputs: { goal: { required: true, shape: STRING } },
        outputContracts: { plan: { required: true, shape: STRING } },
        inputBindings: { goal: "goal" },
        writeBindings: { plan: "plan" },
        config: { instructions: "Draft a plan." }
      },
      { availableBagShape: { goal: "string" } }
    );
    expect(llm.nodePlanValid).toBe(true);

    const tool = await runFactory(
      {
        nodeType: "tool",
        title: "Load",
        inputs: { query: { required: true, shape: STRING } },
        outputContracts: { matches: { required: true, shape: JSON_SHAPE } },
        inputBindings: { query: "goal" },
        writeBindings: { matches: "matches" },
        config: { name: "loadContext" }
      },
      { availableBagShape: { goal: "string" } }
    );
    expect(tool.nodePlanValid).toBe(true);
  });
});

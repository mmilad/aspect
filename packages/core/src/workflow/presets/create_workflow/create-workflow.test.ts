import { describe, expect, it } from "vitest";
import {
  WORKFLOW_NODE_PLAN_V1_KEY,
  WORKFLOW_NODE_QA_V1_KEY,
  WORKFLOW_STEP_LIST_V1_KEY
} from "../../llm/llm-json-schemas";
import { parseWorkflowGraph, type WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { WorkflowRun } from "../../runtime";
import { createStepGraph } from "../create_step/graph";
import { createWorkflowGraph } from "./graph";

const NUMBER = { kind: "primitive" as const, type: "number" as const };

function parsed(raw: unknown): WorkflowGraph {
  const result = parseWorkflowGraph(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.graph;
}

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

const MULTIPLY_NODE_PLAN = {
  nodeType: "math",
  title: "Multiply by three",
  purpose: "Multiply dividedByTwo by three and expose the result as timesThree.",
  reads: ["dividedByTwo"],
  writes: ["timesThree"],
  inputs: { value: { required: true, shape: NUMBER } },
  outputContracts: { result: { required: true, shape: NUMBER } },
  inputBindings: { value: "dividedByTwo" },
  writeBindings: { result: "timesThree" },
  config: { operation: "multiply", operand: 3 }
};

describe("create_workflow preset", () => {
  it("parses variables, loop pins, and the create_step subworkflow", () => {
    const result = parseWorkflowGraph(createWorkflowGraph);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errors.join("\n"));
    }
    expect(result.graph.version).toBe(WORKFLOW_SCHEMA_VERSION);
    expect(result.graph.variables?.some((variable) => variable.name === "brief")).toBe(true);
    expect(result.graph.nodes.some((node) => node.type === "subworkflow")).toBe(true);
    expect(result.graph.nodes.some((node) => node.type === "assemble_fragment")).toBe(true);
    expect(
      result.graph.edges.some(
        (edge) => edge.kind === "route" && edge.sourcePin === "loop" && edge.target === "run_create_step"
      )
    ).toBe(true);
    const plan = result.graph.nodes.find((node) => node.id === "plan_steps");
    expect(plan?.data.llm?.schemaKey).toBe(WORKFLOW_STEP_LIST_V1_KEY);
    expect(plan?.data.llm?.instructions).toContain("There is no maximum");
    expect(plan?.data.llm?.instructions).toContain("Title: <unique title>");
    expect(plan?.data.llm?.instructions).toContain("Do not include start or end");
  });

  it("plans two instructions, accumulates stepDrafts, and chains assembled data wires", async () => {
    const createStep = parsed(createStepGraph);
    const run = new WorkflowRun({
      graph: parsed(createWorkflowGraph),
      bag: {
        workflowId: "create_workflow",
        cursor: "start",
        goal: "create workflow",
        keys: {
          brief: "Halve currentValue, then triple that result.",
          availableBagShape: {
            currentValue: "number",
            dividedByTwo: "number",
            timesThree: "number"
          },
          allowedNodeTypes: ["math"]
        },
        status: "running"
      },
      adapters: {
        resolveSubworkflow: (workflowId) => (workflowId === "create_step" ? createStep : null)
      }
    });

    async function drain() {
      let step = await run.step();
      let hops = 0;
      while (step.kind === "advanced") {
        hops += 1;
        if (hops > 40) {
          throw new Error("create_workflow test exceeded advanced-step budget");
        }
        step = await run.step();
      }
      return step;
    }

    let step = await drain();
    expect(step.kind).toBe("pending_llm");
    expect(step.nodeId).toBe("plan_steps");
    expect(step.llm?.schemaKey).toBe(WORKFLOW_STEP_LIST_V1_KEY);

    step = await run.step({
      llmWrites: {
        stepInstructionsList: [
          "Divide currentValue by two and write dividedByTwo.",
          "Multiply dividedByTwo by three and write timesThree."
        ]
      }
    });
    while (step.kind === "advanced") {
      step = await run.step();
    }
    expect(step.kind).toBe("pending_llm");
    expect(step.nodeId).toBe("run_create_step");
    expect(step.llm?.schemaKey).toBe(WORKFLOW_NODE_PLAN_V1_KEY);

    step = await run.step({ llmWrites: { nodePlan: MATH_NODE_PLAN } });
    while (step.kind === "advanced") {
      step = await run.step();
    }
    expect(step.kind).toBe("pending_llm");
    expect(step.nodeId).toBe("run_create_step");
    expect(step.llm?.schemaKey).toBe(WORKFLOW_NODE_QA_V1_KEY);

    step = await run.step({
      llmWrites: {
        nodeAccepted: true,
        qaReason: "Math node divides currentValue by two and writes dividedByTwo.",
        repairInstructions: "",
        improvements: []
      }
    });
    while (step.kind === "advanced") {
      step = await run.step();
    }
    expect(step.kind).toBe("pending_llm");
    expect(step.nodeId).toBe("run_create_step");
    expect(step.llm?.schemaKey).toBe(WORKFLOW_NODE_PLAN_V1_KEY);

    step = await run.step({ llmWrites: { nodePlan: MULTIPLY_NODE_PLAN } });
    while (step.kind === "advanced") {
      step = await run.step();
    }
    expect(step.kind).toBe("pending_llm");
    expect(step.nodeId).toBe("run_create_step");
    expect(step.llm?.schemaKey).toBe(WORKFLOW_NODE_QA_V1_KEY);

    step = await run.step({
      llmWrites: {
        nodeAccepted: true,
        qaReason: "Math node multiplies dividedByTwo by three and writes timesThree.",
        repairInstructions: "",
        improvements: []
      }
    });
    while (step.kind === "advanced") {
      step = await run.step();
    }
    expect(step.kind).toBe("completed");
    const draft = step.bag.keys.workflowDraft as WorkflowGraph | undefined;
    expect(draft?.nodes.map((node) => node.type)).toEqual(["start", "math", "math", "end"]);
    const mathNodes = draft?.nodes.filter((node) => node.type === "math") ?? [];
    expect(mathNodes).toHaveLength(2);
    expect(draft?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "start", target: mathNodes[0]?.id, kind: "next" }),
        expect.objectContaining({ source: mathNodes[0]?.id, target: mathNodes[1]?.id, kind: "next" }),
        expect.objectContaining({ source: mathNodes[1]?.id, target: "end", kind: "next" }),
        expect.objectContaining({
          kind: "data",
          source: mathNodes[0]?.id,
          target: mathNodes[1]?.id,
          sourcePin: "result",
          targetPin: "value"
        })
      ])
    );
    expect(draft?.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "data",
          source: "start",
          target: mathNodes[1]?.id
        })
      ])
    );
  });
});

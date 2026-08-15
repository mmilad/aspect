import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../../schema";
import { WorkflowRun } from "../../runtime/workflow";
import type { WorkflowGraph } from "../../types";

const NUMBER = { kind: "primitive" as const, type: "number" as const };

function parsed(raw: unknown): WorkflowGraph {
  const result = parseWorkflowGraph(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.graph;
}

function edge(
  id: string,
  source: string,
  sourcePin: string,
  target: string,
  targetPin: string,
  kind: "next" | "data" = "data"
) {
  return { id, source, target, kind, sourcePin, targetPin };
}

function singleMathGraph(operation: string, operand: number, options?: { wireInput?: boolean }) {
  const wireInput = options?.wireInput ?? true;
  return parsed({
    version: WORKFLOW_SCHEMA_VERSION,
    variables: [
      { name: "currentValue", role: "input", shape: NUMBER, required: !wireInput ? false : true },
      { name: "result", role: "output", shape: NUMBER, required: true }
    ],
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      {
        id: "math",
        type: "math",
        position: { x: 200, y: 0 },
        data: {
          title: "Math",
          inputs: { value: { required: true, shape: NUMBER } },
          outputContracts: { result: { required: true, shape: NUMBER } },
          math: { operation, operand }
        }
      },
      { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      edge("e_start_math", "start", "then", "math", "in", "next"),
      edge("e_math_end", "math", "then", "end", "in", "next"),
      ...(wireInput ? [edge("d_start_math", "start", "currentValue", "math", "value")] : []),
      edge("d_math_end", "math", "result", "end", "result")
    ]
  });
}

async function runGraph(graph: WorkflowGraph, keys: Record<string, unknown>) {
  const run = new WorkflowRun({
    graph,
    bag: {
      workflowId: "math_test",
      cursor: "start",
      goal: "math test",
      keys,
      status: "running"
    }
  });
  return run.runUntilPause();
}

describe("math execution", () => {
  it.each([
    ["add", 4, 16],
    ["subtract", 4, 8],
    ["multiply", 3, 36],
    ["divide", 2, 6]
  ])("%s calculates one numeric result", async (operation, operand, expected) => {
    const result = await runGraph(singleMathGraph(operation, operand), { currentValue: 12 });

    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.result).toBe(expected);
    expect(result.bag.keys.result).toBe(expected);
  });

  it("fails when the value input is missing", async () => {
    const result = await runGraph(singleMathGraph("add", 1, { wireInput: false }), {});

    expect(result.kind).toBe("failed");
    expect(result.message).toContain("Missing required input 'value'");
  });

  it("fails when the value input is not a number", async () => {
    const result = await runGraph(singleMathGraph("add", 1), { currentValue: "12" });

    expect(result.kind).toBe("failed");
    expect(result.message).toContain("Input 'value' failed shape check");
  });

  it("fails on divide by zero", async () => {
    const result = await runGraph(singleMathGraph("divide", 0), { currentValue: 12 });

    expect(result.kind).toBe("failed");
    expect(result.message).toContain("cannot divide by zero");
  });

  it("runs the arithmetic proof workflow and returns three End outputs", async () => {
    const graph = arithmeticProofGraph();
    const result = await runGraph(graph, { currentValue: 12 });

    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs).toMatchObject({
      dividedByTwo: 6,
      multipliedByThree: 36,
      subtractedFour: 8
    });
    expect(result.bag.keys).toMatchObject({
      dividedByTwo: 6,
      multipliedByThree: 36,
      subtractedFour: 8
    });
  });
});

export function arithmeticProofGraph(): WorkflowGraph {
  return parsed({
    version: WORKFLOW_SCHEMA_VERSION,
    variables: [
      { name: "currentValue", role: "input", shape: NUMBER, required: true },
      { name: "dividedByTwo", role: "output", shape: NUMBER, required: true },
      { name: "multipliedByThree", role: "output", shape: NUMBER, required: true },
      { name: "subtractedFour", role: "output", shape: NUMBER, required: true }
    ],
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 120 }, data: { title: "Start" } },
      {
        id: "divide_by_two",
        type: "math",
        position: { x: 220, y: 40 },
        data: {
          title: "Divide by two",
          inputs: { value: { required: true, shape: NUMBER } },
          outputContracts: { result: { required: true, shape: NUMBER } },
          math: { operation: "divide", operand: 2 }
        }
      },
      {
        id: "multiply_by_three",
        type: "math",
        position: { x: 440, y: 120 },
        data: {
          title: "Multiply by three",
          inputs: { value: { required: true, shape: NUMBER } },
          outputContracts: { result: { required: true, shape: NUMBER } },
          math: { operation: "multiply", operand: 3 }
        }
      },
      {
        id: "subtract_four",
        type: "math",
        position: { x: 660, y: 200 },
        data: {
          title: "Subtract four",
          inputs: { value: { required: true, shape: NUMBER } },
          outputContracts: { result: { required: true, shape: NUMBER } },
          math: { operation: "subtract", operand: 4 }
        }
      },
      { id: "end", type: "end", position: { x: 880, y: 120 }, data: { title: "End" } }
    ],
    edges: [
      edge("e_start_divide", "start", "then", "divide_by_two", "in", "next"),
      edge("e_divide_multiply", "divide_by_two", "then", "multiply_by_three", "in", "next"),
      edge("e_multiply_subtract", "multiply_by_three", "then", "subtract_four", "in", "next"),
      edge("e_subtract_end", "subtract_four", "then", "end", "in", "next"),
      edge("d_start_divide", "start", "currentValue", "divide_by_two", "value"),
      edge("d_start_multiply", "start", "currentValue", "multiply_by_three", "value"),
      edge("d_start_subtract", "start", "currentValue", "subtract_four", "value"),
      edge("d_divide_end", "divide_by_two", "result", "end", "dividedByTwo"),
      edge("d_multiply_end", "multiply_by_three", "result", "end", "multipliedByThree"),
      edge("d_subtract_end", "subtract_four", "result", "end", "subtractedFour")
    ]
  });
}

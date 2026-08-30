import { describe, expect, it } from "vitest";
import { type LlmChatConfig } from "./chat-completions";
import {
  buildWorkflowCompileSystemPrompt,
  buildWorkflowOutlineSystemPrompt,
  extractJsonObject,
  generateWorkflowTwoTurn,
  parseGeneratedWorkflowGraph,
  scaffoldWorkflowFromBrief
} from "./generate";
import { parseWorkflowGraph } from "../../workflow/graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../workflow/nodes";
import { WorkflowRun } from "../../workflow/runtime/workflow";

const NUMBER = { kind: "primitive" as const, type: "number" as const };

describe("workflow author", () => {
  it("builds outline and compile prompts", () => {
    const outline = buildWorkflowOutlineSystemPrompt();
    expect(outline).toContain("numbered list");
    expect(outline).toContain("Do NOT output JSON");

    const compile = buildWorkflowCompileSystemPrompt();
    expect(compile).toContain("Workflow Step Graph v4");
    expect(compile).toContain("Return ONLY valid JSON");
    expect(compile).toContain("variables");
    expect(compile).toContain("math nodes");
  });

  it("scaffolds a valid graph that embeds the brief on an llm node", () => {
    const graph = scaffoldWorkflowFromBrief({
      brief: "Orient on the workspace aspect and propose next tasks.",
      title: "Orient workspace"
    });
    const parsed = parseWorkflowGraph(graph);
    expect(parsed.ok).toBe(true);
    const llm = graph.nodes.find((node) => node.type === "llm");
    expect(llm?.data.llm?.instructions).toContain("Orient on the workspace aspect");
  });

  it("parses fenced JSON generations", () => {
    const graph = scaffoldWorkflowFromBrief({ brief: "x" });
    const text = `Here you go:\n\`\`\`json\n${JSON.stringify(graph)}\n\`\`\``;
    const result = parseGeneratedWorkflowGraph(text);
    expect(result.ok).toBe(true);
  });

  it("extracts bare objects", () => {
    const obj = extractJsonObject('prefix {"a":1} suffix');
    expect(obj).toEqual({ a: 1 });
  });

  it("two-turn generate returns outline and parsed graph (fixture LLM)", async () => {
    const outlineText = [
      "1. Start with goal",
      "2. Load aspects from context",
      "3. LLM chooses aspect id",
      "4. End"
    ].join("\n");

    const fixtureGraph = scaffoldWorkflowFromBrief({
      brief: "search then choose",
      title: "Fixture flow"
    });

    const config: LlmChatConfig = {
      baseUrl: "http://fixture.local/v1",
      model: "fixture"
    };

    const originalFetch = globalThis.fetch;
    let turn = 0;
    globalThis.fetch = (async () => {
      turn += 1;
      const content = turn === 1 ? outlineText : JSON.stringify(fixtureGraph);
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    try {
      const result = await generateWorkflowTwoTurn(
        { brief: "search then choose", title: "Fixture flow" },
        config
      );
      expect(result.outline).toContain("Load aspects");
      expect(result.graphJson).toContain('"version"');
      expect(result.graph?.nodes.some((node) => node.type === "llm")).toBe(true);
      expect(result.parseErrors).toBeUndefined();
      expect(turn).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("two-turn generate can produce a runnable pin-frame arithmetic workflow", async () => {
    const outlineText = [
      "1. Start with currentValue.",
      "2. Divide currentValue by 2.",
      "3. Multiply currentValue by 3.",
      "4. Subtract 4 from currentValue.",
      "5. Return all three numbers."
    ].join("\n");
    const fixtureGraph = arithmeticProofGraph();
    const config: LlmChatConfig = {
      baseUrl: "http://fixture.local/v1",
      model: "fixture"
    };

    const originalFetch = globalThis.fetch;
    let turn = 0;
    globalThis.fetch = (async () => {
      turn += 1;
      const content = turn === 1 ? outlineText : JSON.stringify(fixtureGraph);
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    try {
      const generated = await generateWorkflowTwoTurn(
        {
          brief:
            "The workflow gets currentValue:number and returns dividedByTwo, multipliedByThree, and subtractedFour.",
          title: "Arithmetic proof"
        },
        config
      );
      expect(generated.parseErrors).toBeUndefined();
      const parsedResponse = parseGeneratedWorkflowGraph(generated.graphJson);
      expect(parsedResponse.ok).toBe(true);
      if (!parsedResponse.ok) {
        throw new Error(parsedResponse.errors.join("\n"));
      }
      expect(parsedResponse.graph.variables?.map((variable) => variable.name)).toEqual([
        "currentValue",
        "dividedByTwo",
        "multipliedByThree",
        "subtractedFour"
      ]);

      const run = new WorkflowRun({
        graph: parsedResponse.graph,
        bag: {
          workflowId: "arithmetic_proof",
          cursor: "start",
          goal: "arithmetic proof",
          keys: { currentValue: 12 },
          status: "running"
        }
      });
      const result = await run.runUntilPause();

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
      expect(turn).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function data(id: string, source: string, sourcePin: string, target: string, targetPin: string) {
  return { id, source, target, kind: "data" as const, sourcePin, targetPin };
}

function next(id: string, source: string, target: string) {
  return { id, source, target, kind: "next" as const, sourcePin: "then", targetPin: "in" };
}

function mathNode(id: string, title: string, operation: string, operand: number, x: number, y: number) {
  return {
    id,
    type: "math" as const,
    position: { x, y },
    data: {
      title,
      inputs: { value: { required: true, shape: NUMBER } },
      outputContracts: { result: { required: true, shape: NUMBER } },
      math: { operation, operand }
    }
  };
}

function arithmeticProofGraph() {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    variables: [
      { name: "currentValue", role: "input" as const, shape: NUMBER, required: true },
      { name: "dividedByTwo", role: "output" as const, shape: NUMBER, required: true },
      { name: "multipliedByThree", role: "output" as const, shape: NUMBER, required: true },
      { name: "subtractedFour", role: "output" as const, shape: NUMBER, required: true }
    ],
    nodes: [
      { id: "start", type: "start" as const, position: { x: 0, y: 120 }, data: { title: "Start" } },
      mathNode("divide_by_two", "Divide by two", "divide", 2, 220, 40),
      mathNode("multiply_by_three", "Multiply by three", "multiply", 3, 440, 120),
      mathNode("subtract_four", "Subtract four", "subtract", 4, 660, 200),
      { id: "end", type: "end" as const, position: { x: 880, y: 120 }, data: { title: "End" } }
    ],
    edges: [
      next("e_start_divide", "start", "divide_by_two"),
      next("e_divide_multiply", "divide_by_two", "multiply_by_three"),
      next("e_multiply_subtract", "multiply_by_three", "subtract_four"),
      next("e_subtract_end", "subtract_four", "end"),
      data("d_start_divide", "start", "currentValue", "divide_by_two", "value"),
      data("d_start_multiply", "start", "currentValue", "multiply_by_three", "value"),
      data("d_start_subtract", "start", "currentValue", "subtract_four", "value"),
      data("d_divide_end", "divide_by_two", "result", "end", "dividedByTwo"),
      data("d_multiply_end", "multiply_by_three", "result", "end", "multipliedByThree"),
      data("d_subtract_end", "subtract_four", "result", "end", "subtractedFour")
    ]
  };
}

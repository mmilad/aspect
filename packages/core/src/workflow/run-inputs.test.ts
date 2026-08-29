import { describe, expect, it } from "vitest";
import { emptyWorkflowGraph } from "./schema";
import { thinkingGraph } from "./presets/thinking";
import {
  defaultRunInputValue,
  describeRunInput,
  missingRequiredRunInputs,
  seedRunInputBag,
  workflowRunInputs
} from "./run-inputs";

describe("workflowRunInputs", () => {
  it("reads pin-frame input variables including required flags", () => {
    const inputs = workflowRunInputs(thinkingGraph);
    const names = inputs.map((input) => input.name);
    expect(names).toContain("task");
    expect(names).toContain("expectedOutput");
    expect(inputs.find((input) => input.name === "task")?.required).toBe(true);
    expect(inputs.find((input) => input.name === "context")?.required).toBe(false);
  });

  it("falls back to Start outputContracts on bag graphs", () => {
    const graph = emptyWorkflowGraph();
    const start = graph.nodes.find((node) => node.type === "start")!;
    start.data = {
      title: "Start",
      writes: ["goal", "limit"],
      writeBindings: { goal: "goal", limit: "limit" },
      outputContracts: {
        goal: { required: true, shape: { kind: "primitive", type: "string" } },
        limit: { required: false, shape: { kind: "primitive", type: "number" } }
      }
    };
    const inputs = workflowRunInputs(graph);
    expect(inputs).toEqual([
      { name: "goal", required: true, shape: { kind: "primitive", type: "string" } },
      { name: "limit", required: false, shape: { kind: "primitive", type: "number" } }
    ]);
    expect(seedRunInputBag(inputs)).toEqual({ goal: "", limit: 0 });
    expect(missingRequiredRunInputs(inputs, { limit: 3 })).toEqual(["goal"]);
    expect(describeRunInput(inputs[0]!)).toBe("goal*: string");
  });

  it("seeds union and array defaults", () => {
    expect(defaultRunInputValue({ kind: "array", items: { kind: "primitive", type: "string" } })).toEqual([]);
    expect(
      defaultRunInputValue({
        kind: "union",
        options: [
          { kind: "primitive", type: "null" },
          { kind: "primitive", type: "string" }
        ]
      })
    ).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../schema";
import { createStepGraph } from "./create-step";

describe("create_step pin graph", () => {
  it("parses variables and data edges", () => {
    const parsed = parseWorkflowGraph(createStepGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.errors.join("\n"));
    }
    expect(parsed.graph.version).toBe(WORKFLOW_SCHEMA_VERSION);
    expect(parsed.graph.variables?.some((variable) => variable.name === "stepInstructions")).toBe(true);
    expect(parsed.graph.edges.some((edge) => edge.kind === "data")).toBe(true);
    expect(parsed.graph.nodes.filter((node) => node.type === "reroute")).toHaveLength(3);
    expect(
      parsed.graph.edges.some(
        (edge) =>
          edge.kind === "data" &&
          edge.source === "r_step_instructions" &&
          edge.target === "interpret_node_plan"
      )
    ).toBe(true);
    expect(parsed.graph.nodes.find((node) => node.type === "start")?.data.outputContracts?.stepInstructions).toBeTruthy();
    expect(parsed.graph.nodes.find((node) => node.type === "end")?.data.inputs?.stepDraft).toBeTruthy();
    const interpret = parsed.graph.nodes.find((node) => node.id === "interpret_node_plan");
    const instructions = interpret?.data.llm?.instructions ?? "";
    expect(instructions).toContain("typed pins");
    expect(instructions).toContain("inputBindings maps node input pin ids");
    expect(instructions).toContain("writeBindings maps node output pin ids");
    expect(instructions).toContain("not bag names");
    expect(instructions).toContain("For arithmetic, prefer math");
    expect(instructions).toContain("For map, only project fields");
  });
});

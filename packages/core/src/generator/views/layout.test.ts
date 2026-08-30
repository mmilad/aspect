import { describe, expect, it } from "vitest";
import { layoutWorkflowGraph } from "./layout";
import { parseWorkflowGraph } from "../../workflow/graph";
import { createStepGraph } from "../../workflow/presets/create_step/graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../workflow/nodes";

const STRING = { kind: "primitive" as const, type: "string" as const };

describe("layoutWorkflowGraph", () => {
  it("layers create_step left to right with fix below the spine", () => {
    const parsed = parseWorkflowGraph(createStepGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const laid = layoutWorkflowGraph(parsed.graph);
    const at = (id: string) => laid.nodes.find((node) => node.id === id)!.position;

    expect(at("start").x).toBeLessThan(at("interpret_node_plan").x);
    expect(at("interpret_node_plan").x).toBeLessThan(at("create_node").x);
    expect(at("create_node").x).toBeLessThan(at("verify_node").x);
    expect(at("end").x).toBeGreaterThan(at("verify_node").x);

    expect(at("r_step_instructions").x).toBeGreaterThan(at("start").x);
    expect(at("r_step_instructions").x).toBeLessThan(at("interpret_node_plan").x);
    expect(at("r_allowed_node_types").y).toBeGreaterThan(at("r_step_instructions").y);

    expect(at("fix_node_plan").y).toBeGreaterThan(at("interpret_node_plan").y);
    expect(laid.edges.every((edge) => !edge.waypoints)).toBe(true);
  });

  it("places a template off the exec spine next to its data source", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "name", role: "input", shape: STRING, required: true },
        { name: "reply", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "greet",
          type: "template",
          position: { x: 999, y: 999 },
          data: {
            title: "Greet",
            template: "Hello {{name}}",
            inputs: { name: { required: true, shape: STRING } },
            outputContracts: { text: { required: true, shape: STRING } }
          }
        },
        {
          id: "draft",
          type: "llm",
          position: { x: 200, y: 0 },
          data: {
            title: "Draft",
            inputs: { prompt: { required: true, shape: STRING } },
            llm: { format: "text", instructions: "{{prompt}}" }
          }
        },
        { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "draft", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "draft", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "greet", kind: "data", sourcePin: "name", targetPin: "name" },
        { id: "d2", source: "greet", target: "draft", kind: "data", sourcePin: "text", targetPin: "prompt" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const laid = layoutWorkflowGraph(parsed.graph);
    const at = (id: string) => laid.nodes.find((node) => node.id === id)!.position;
    expect(at("start").x).toBeLessThan(at("draft").x);
    expect(at("greet").x).toBeGreaterThan(at("start").x);
    expect(at("greet").x).toBeLessThan(at("draft").x);
    expect(at("greet").y).not.toBe(at("draft").y);
  });
});

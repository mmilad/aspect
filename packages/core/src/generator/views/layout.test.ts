import { describe, expect, it } from "vitest";
import { layoutWorkflowGraph } from "./layout";
import { parseWorkflowGraph } from "../../workflow/graph";
import { createStepGraph } from "../../workflow/presets/create_step/graph";

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
});

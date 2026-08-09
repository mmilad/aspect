import { describe, expect, it } from "vitest";
import { bagViewAtNode, parseWorkflowGraph, serializeShapeSlim } from "../schema";
import { ensureAspectPreset, listWorkflowPresets } from "./index";

describe("workflow presets", () => {
  it("lists ensure_aspect pack", () => {
    const presets = listWorkflowPresets();
    expect(presets.some((preset) => preset.presetKey === "ensure_aspect")).toBe(true);
  });

  it("ensure_aspect graph parses as v2", () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.graph.version).toBe(2);
    expect(parsed.graph.nodes.some((node) => node.type === "map")).toBe(true);
    expect(parsed.graph.nodes.some((node) => node.type === "switch")).toBe(true);
  });

  it("propagates Entity[] into slim map candidates shape", () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const atSlim = bagViewAtNode(parsed.graph, "slim");
    expect(serializeShapeSlim(atSlim.matches)).toBe("Entity[]");
    const atDecide = bagViewAtNode(parsed.graph, "decide");
    expect(serializeShapeSlim(atDecide.candidates)).toContain("object{");
  });
});

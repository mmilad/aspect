import { describe, expect, it } from "vitest";
import { bagViewAtNode, parseWorkflowGraph, serializeShapeSlim } from "../schema";
import { ensureAspectPreset, listWorkflowPresets } from "./index";

describe("workflow presets", () => {
  it("lists ensure_aspect and CRUD skeletons", () => {
    const presets = listWorkflowPresets();
    expect(presets.some((preset) => preset.presetKey === "ensure_aspect")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "create_task")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "delete_aspect")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "next_work")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "onboarding")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "rollup_parent_status")).toBe(true);
  });

  it("every pack parses as v2", () => {
    for (const preset of listWorkflowPresets()) {
      const parsed = parseWorkflowGraph(preset.graph);
      expect(parsed.ok, preset.presetKey).toBe(true);
    }
  });

  it("ensure_aspect graph parses as v2", () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.graph.version).toBe(2);
    expect(parsed.graph.nodes.some((node) => node.type === "map")).toBe(true);
    expect(parsed.graph.nodes.some((node) => node.type === "branch")).toBe(true);
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

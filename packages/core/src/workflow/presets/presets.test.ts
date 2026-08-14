import { describe, expect, it } from "vitest";
import {
  bagViewAtNode,
  parseWorkflowGraph,
  serializeShapeSlim,
  WORKFLOW_SCHEMA_VERSION
} from "../schema";
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
    expect(presets.some((preset) => preset.presetKey === "author_workflow")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "create_step")).toBe(true);
  });

  it("every pack parses into the current workflow graph version", () => {
    for (const preset of listWorkflowPresets()) {
      const parsed = parseWorkflowGraph(preset.graph);
      expect(parsed.ok, preset.presetKey).toBe(true);
      if (parsed.ok) {
        expect(parsed.graph.version).toBe(WORKFLOW_SCHEMA_VERSION);
      }
    }
  });

  it("ensure_aspect graph parses into the current workflow graph version", () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.graph.version).toBe(WORKFLOW_SCHEMA_VERSION);
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

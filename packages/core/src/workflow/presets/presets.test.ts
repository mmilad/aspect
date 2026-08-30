import { describe, expect, it } from "vitest";
import { bagViewAtNode, serializeShapeSlim } from "../bag";
import { parseWorkflowGraph } from "../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../nodes";
import {
  ensureAspectPreset,
  listParkedWorkflowPresets,
  listWorkflowPresets,
  resolveWorkflowKind,
  workflowPresetAllowsDrainLlm
} from "./index";

describe("workflow presets", () => {
  it("lists mutation packs and create_step, parks authoring presets", () => {
    const presets = listWorkflowPresets();
    expect(presets.some((preset) => preset.presetKey === "ensure_aspect")).toBe(false);
    expect(presets.some((preset) => preset.presetKey === "next_work")).toBe(false);
    expect(presets.some((preset) => preset.presetKey === "onboarding")).toBe(false);
    expect(presets.some((preset) => preset.presetKey === "author_workflow")).toBe(false);
    expect(presets.some((preset) => preset.presetKey === "create_task")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "delete_aspect")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "rollup_parent_status")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "create_step")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "create_workflow")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "thinking")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "goal_planning")).toBe(true);
    expect(presets.some((preset) => preset.presetKey === "assistant_turn")).toBe(true);
  });

  it("assigns a closed kind to every catalog pack", () => {
    const catalog = [...listWorkflowPresets(), ...listParkedWorkflowPresets()];
    for (const preset of catalog) {
      expect(preset.kind, preset.presetKey).toBeTruthy();
    }
    expect(listWorkflowPresets().find((preset) => preset.presetKey === "create_task")?.kind).toBe(
      "mutation"
    );
    expect(listWorkflowPresets().find((preset) => preset.presetKey === "create_step")?.kind).toBe(
      "builder"
    );
    expect(listWorkflowPresets().find((preset) => preset.presetKey === "create_workflow")?.kind).toBe(
      "builder"
    );
    expect(
      listWorkflowPresets().find((preset) => preset.presetKey === "rollup_parent_status")?.kind
    ).toBe("housekeeping");
    expect(listParkedWorkflowPresets().find((preset) => preset.presetKey === "onboarding")?.kind).toBe(
      "orientation"
    );
    expect(listWorkflowPresets().find((preset) => preset.presetKey === "assistant_turn")?.kind).toBe(
      "user"
    );
  });

  it("resolves kind from catalog presetKey before persisted presetKind", () => {
    expect(resolveWorkflowKind({ presetKey: "create_task", kind: "user" })).toBe("mutation");
    expect(resolveWorkflowKind({ presetKey: "create_workflow" })).toBe("builder");
    expect(resolveWorkflowKind({ kind: "housekeeping" })).toBe("housekeeping");
    expect(resolveWorkflowKind({ presetKey: "not_a_pack", kind: "orientation" })).toBe("orientation");
    expect(resolveWorkflowKind({})).toBe("user");
    expect(resolveWorkflowKind({ kind: "nope" })).toBe("user");
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

  it("parses parked packs without seeding them", () => {
    expect(listParkedWorkflowPresets().some((preset) => preset.presetKey === "goal_planning")).toBe(false);
    for (const preset of listParkedWorkflowPresets()) {
      const parsed = parseWorkflowGraph(preset.graph);
      expect(parsed.ok, `${preset.presetKey}: ${parsed.ok ? "" : parsed.errors.join("; ")}`).toBe(true);
    }
  });

  it("refuses drainLlm for goal_planning and allows it for thinking", () => {
    expect(workflowPresetAllowsDrainLlm("goal_planning")).toBe(false);
    expect(workflowPresetAllowsDrainLlm("thinking")).toBe(true);
    expect(workflowPresetAllowsDrainLlm("assistant_turn")).toBe(true);
    expect(workflowPresetAllowsDrainLlm("create_task")).toBe(true);
    expect(workflowPresetAllowsDrainLlm(null)).toBe(true);
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

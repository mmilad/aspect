import { describe, expect, it } from "vitest";
import { ensureAspectPreset } from "./presets";
import { parseWorkflowGraph } from "./schema";
import { renderWorkflowStory } from "./story";

describe("renderWorkflowStory", () => {
  it("tells ensure_aspect as a branched story", () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const story = renderWorkflowStory(parsed.graph, {
      title: ensureAspectPreset.title,
      description: ensureAspectPreset.summary
    });
    expect(story).toContain("# Ensure Aspect");
    expect(story).toContain("Look up");
    expect(story).toContain("Project");
    expect(story).toContain("LLM decide");
    expect(story).toContain("Branch on `createNew`");
    expect(story).toContain("if `true`");
    expect(story).toContain("if `false`");
    expect(story).toContain("Write `create_entity`");
  });

  it("shortens subworkflow steps", () => {
    const parsed = parseWorkflowGraph({
      version: 2,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        {
          id: "child",
          type: "subworkflow",
          position: { x: 100, y: 0 },
          data: {
            title: "Ensure",
            subworkflow: {
              workflowId: "ensure_aspect",
              inputMap: { title: "goal" },
              outputMap: { aspectId: "aspectId" }
            }
          }
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "child", kind: "next" },
        { id: "e2", source: "child", target: "end", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const story = renderWorkflowStory(parsed.graph);
    expect(story).toContain("Run subworkflow `ensure_aspect`");
    expect(story).toContain("`goal`→`title`");
    expect(story).toContain("`aspectId`→`aspectId`");
  });
});

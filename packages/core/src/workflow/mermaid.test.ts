import { describe, expect, it } from "vitest";
import { ensureAspectPreset } from "./presets";
import { parseWorkflowGraph } from "./schema";
import { mermaidNodeId, renderWorkflowMermaid } from "./mermaid";

describe("renderWorkflowMermaid", () => {
  it("maps ensure_aspect to a branched flowchart", () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const source = renderWorkflowMermaid(parsed.graph, { title: ensureAspectPreset.title });
    expect(source).toContain("%% Ensure Aspect");
    expect(source).toContain("flowchart TD");
    expect(source).toContain('start(["Start"])');
    expect(source).toContain('route{"Create new?"}');
    expect(source).toContain('route -->|"true"| create');
    expect(source).toContain('route -->|"false"| end_reuse');
    expect(source).toContain('create["Create aspect"]');
    expect(source).toContain('end_reuse(["End (reused)"])');
  });

  it("prefixes reserved mermaid ids", () => {
    expect(mermaidNodeId("end")).toBe("n_end");
    expect(mermaidNodeId("start")).toBe("start");
  });
});

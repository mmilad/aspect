import { describe, expect, it } from "vitest";
import { ensureAspectPreset } from "../../workflow/presets";
import { parseWorkflowGraph } from "../../workflow/graph";
import { mermaidNodeId, renderWorkflowMermaid, workflowIdFromMermaidDomId } from "./mermaid";

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

  it("maps mermaid SVG ids back to workflow node ids", () => {
    const ids = ["start", "end", "llm_ab12"];
    expect(workflowIdFromMermaidDomId("flowchart-n_end-0", ids)).toBe("end");
    expect(workflowIdFromMermaidDomId("flowchart-start-0", ids)).toBe("start");
    expect(workflowIdFromMermaidDomId("n_end", ids)).toBe("end");
    expect(workflowIdFromMermaidDomId("flowchart-llm_ab12-3", ids)).toBe("llm_ab12");
    expect(workflowIdFromMermaidDomId("start-0", ids)).toBe("start");
    expect(workflowIdFromMermaidDomId("n_end-1", ids)).toBe("end");
    expect(workflowIdFromMermaidDomId("wf-mermaid-x-flowchart-n_end-0", ids)).toBe("end");
    expect(workflowIdFromMermaidDomId("missing", ids)).toBeNull();
  });
});

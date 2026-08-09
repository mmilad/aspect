import { describe, expect, it } from "vitest";
import {
  buildWorkflowAuthorSystemPrompt,
  extractJsonObject,
  parseGeneratedWorkflowGraph,
  scaffoldWorkflowFromBrief
} from "./author";
import { parseWorkflowGraph } from "./schema";

describe("workflow author", () => {
  it("builds prompts that mention v2 constraints", () => {
    const system = buildWorkflowAuthorSystemPrompt();
    expect(system).toContain("Workflow Step Graph v2");
    expect(system).toContain("Return ONLY valid JSON");
  });

  it("scaffolds a valid graph that embeds the brief on an llm node", () => {
    const graph = scaffoldWorkflowFromBrief({
      brief: "Orient on the workspace aspect and propose next tasks.",
      title: "Orient workspace"
    });
    const parsed = parseWorkflowGraph(graph);
    expect(parsed.ok).toBe(true);
    const llm = graph.nodes.find((node) => node.type === "llm");
    expect(llm?.data.llm?.instructions).toContain("Orient on the workspace aspect");
  });

  it("parses fenced JSON generations", () => {
    const graph = scaffoldWorkflowFromBrief({ brief: "x" });
    const text = `Here you go:\n\`\`\`json\n${JSON.stringify(graph)}\n\`\`\``;
    const result = parseGeneratedWorkflowGraph(text);
    expect(result.ok).toBe(true);
  });

  it("extracts bare objects", () => {
    const obj = extractJsonObject('prefix {"a":1} suffix');
    expect(obj).toEqual({ a: 1 });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildWorkflowCompileSystemPrompt,
  buildWorkflowOutlineSystemPrompt,
  extractJsonObject,
  generateWorkflowTwoTurn,
  parseGeneratedWorkflowGraph,
  scaffoldWorkflowFromBrief,
  type LlmChatConfig
} from "./author";
import { parseWorkflowGraph } from "./schema";

describe("workflow author", () => {
  it("builds outline and compile prompts", () => {
    const outline = buildWorkflowOutlineSystemPrompt();
    expect(outline).toContain("numbered list");
    expect(outline).toContain("Do NOT output JSON");

    const compile = buildWorkflowCompileSystemPrompt();
    expect(compile).toContain("Workflow Step Graph v2");
    expect(compile).toContain("Return ONLY valid JSON");
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

  it("two-turn generate returns outline and parsed graph (fixture LLM)", async () => {
    const outlineText = [
      "1. Start with goal",
      "2. Load aspects from context",
      "3. LLM chooses aspect id",
      "4. End"
    ].join("\n");

    const fixtureGraph = scaffoldWorkflowFromBrief({
      brief: "search then choose",
      title: "Fixture flow"
    });

    const config: LlmChatConfig = {
      baseUrl: "http://fixture.local/v1",
      model: "fixture"
    };

    const originalFetch = globalThis.fetch;
    let turn = 0;
    globalThis.fetch = (async () => {
      turn += 1;
      const content = turn === 1 ? outlineText : JSON.stringify(fixtureGraph);
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    try {
      const result = await generateWorkflowTwoTurn(
        { brief: "search then choose", title: "Fixture flow" },
        config
      );
      expect(result.outline).toContain("Load aspects");
      expect(result.graphJson).toContain('"version"');
      expect(result.graph?.nodes.some((node) => node.type === "llm")).toBe(true);
      expect(result.parseErrors).toBeUndefined();
      expect(turn).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

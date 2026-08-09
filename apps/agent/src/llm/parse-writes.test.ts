import { describe, expect, it } from "vitest";
import { buildAdapterPrompt, parseLlmWrites } from "./parse-writes";

describe("agent llm parse-writes", () => {
  it("labels SYSTEM and TASK sections in the adapter prompt", () => {
    const prompt = buildAdapterPrompt({
      runId: "run_1",
      nodeId: "decide",
      systemPrompt: "Be careful.",
      instructions: "Pick an aspect id.",
      reads: { goal: "workspace" },
      outputSchema: ["aspectId"],
      tools: []
    });
    expect(prompt).toContain("=== SYSTEM ===");
    expect(prompt).toContain("Be careful.");
    expect(prompt).toContain("=== TASK ===");
    expect(prompt).toContain("Pick an aspect id.");
    expect(prompt).toContain('"goal": "workspace"');
  });

  it("parses llmWrites JSON for output schema keys", () => {
    expect(parseLlmWrites('{"aspectId":"a1","noise":1}', ["aspectId"])).toEqual({
      aspectId: "a1"
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  generateWorkflowTwoTurn,
  readLlmChatConfigFromEnv,
  scaffoldWorkflowFromBrief
} from "./author";

/**
 * Live against a local OpenAI-compatible endpoint (e.g. Ollama).
 * Run with: pnpm test:llm
 * Requires PROJECTPLANER_LLM_BASE_URL + PROJECTPLANER_LLM_MODEL.
 */
describe("workflow author live LLM", () => {
  const config = readLlmChatConfigFromEnv();

  it.skipIf(!config)("two-turn outline → JSON produces a parseable graph", async () => {
    if (!config) {
      return;
    }

    const result = await generateWorkflowTwoTurn(
      {
        brief:
          "Load matching aspects by title, let an LLM pick one id or propose a new title, then end.",
        title: "Live ensure-like"
      },
      config
    );

    expect(result.outline.length).toBeGreaterThan(10);
    expect(result.outline).not.toMatch(/^\s*\{/);
    expect(result.graph).toBeTruthy();
    expect(result.graph!.nodes.some((n) => n.type === "start")).toBe(true);
    expect(result.graph!.nodes.some((n) => n.type === "end" || n.type === "error_end")).toBe(true);
    expect(result.graph!.version).toBe(scaffoldWorkflowFromBrief({ brief: "x" }).version);
  });
});

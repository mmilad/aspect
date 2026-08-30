import { describe, expect, it } from "vitest";
import { readLlmChatConfigFromEnv, runCreateWorkflowLive } from "../../../generator/author";

/**
 * Live create_workflow against a local OpenAI-compatible endpoint (Ollama).
 * Prefer: pnpm plan create-workflow-demo --brief "..."
 * Or: pnpm test:llm
 * Requires PROJECTPLANER_LLM_BASE_URL + PROJECTPLANER_LLM_MODEL.
 */
describe("create_workflow live LLM", () => {
  const config = readLlmChatConfigFromEnv();

  it.skipIf(!config)("plans two math steps, QAs them, and assembles a chained draft", async () => {
    if (!config) {
      return;
    }

    const result = await runCreateWorkflowLive(
      {
        brief: "Halve currentValue, then triple that result. Use math nodes only.",
        availableBagShape: {
          currentValue: "number",
          dividedByTwo: "number",
          timesThree: "number"
        },
        allowedNodeTypes: ["math"],
        onTurn: (turn) => {
          console.log(`live LLM ${turn.turn} ${turn.nodeId} ${turn.schemaKey ?? ""}`, turn.writes);
        }
      },
      config
    );

    expect(result.ok, result.message).toBe(true);
    expect(result.status).toBe("completed");
    const draft = result.draft;
    expect(draft?.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining(["start", "math", "math", "end"])
    );
    const mathNodes = draft?.nodes.filter((node) => node.type === "math") ?? [];
    expect(mathNodes.length).toBeGreaterThanOrEqual(2);
    expect(new Set(mathNodes.map((node) => node.data.title)).size).toBe(mathNodes.length);
    expect(result.turns.some((turn) => turn.schemaKey?.includes("step_list"))).toBe(true);
  }, 300_000);
});

import { describe, expect, it } from "vitest";
import { chatCompletions, readLlmChatConfigFromEnv } from "./chat-completions";
import { extractJsonObject } from "./generate";

const TITLE_CARD_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" }
  },
  required: ["title"],
  additionalProperties: false
};

/**
 * Live: JSON Schema format on chat/completions.
 * Run with: pnpm test:llm
 */
describe("chatCompletions format live", () => {
  const config = readLlmChatConfigFromEnv();

  it.skipIf(!config)("returns JSON matching a tiny title schema", async () => {
    if (!config) {
      return;
    }

    const content = await chatCompletions(
      config,
      [
        { role: "system", content: "Reply with JSON only." },
        { role: "user", content: "A short title for a notes app." }
      ],
      { format: TITLE_CARD_SCHEMA, jsonSchemaName: "title_card" }
    );

    const parsed = extractJsonObject(content) as { title?: unknown };
    expect(typeof parsed.title).toBe("string");
    expect(String(parsed.title).length).toBeGreaterThan(0);
  });
});

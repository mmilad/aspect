import { describe, expect, it } from "vitest";
import {
  chatCompletions,
  chatCompletionsBody,
  openAiResponseFormat,
  type LlmChatConfig
} from "./author";

/** Tiny schema for the dedicated format wire test — not the workflow graph. */
const TITLE_CARD_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" }
  },
  required: ["title"],
  additionalProperties: false
};

const config: LlmChatConfig = {
  baseUrl: "http://fixture.local/v1",
  model: "fixture"
};

describe("chatCompletions format", () => {
  it("omits format when unset (free text)", () => {
    const body = chatCompletionsBody(config, [{ role: "user", content: "hi" }]);
    expect(body.format).toBeUndefined();
    expect(body.response_format).toBeUndefined();
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("passes format=json and OpenAI json_object", () => {
    const body = chatCompletionsBody(config, [{ role: "user", content: "hi" }], { format: "json" });
    expect(body.format).toBe("json");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("passes a JSON Schema as format and OpenAI json_schema", () => {
    const body = chatCompletionsBody(
      config,
      [{ role: "user", content: "Give a title" }],
      { format: TITLE_CARD_SCHEMA, jsonSchemaName: "title_card" }
    );
    expect(body.format).toEqual(TITLE_CARD_SCHEMA);
    expect(body.response_format).toEqual(
      openAiResponseFormat(TITLE_CARD_SCHEMA, "title_card")
    );
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "title_card", strict: true, schema: TITLE_CARD_SCHEMA }
    });
  });

  it("sends format + json_schema on the chat/completions request body", async () => {
    const originalFetch = globalThis.fetch;
    let parsed: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_url, init) => {
      parsed = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"title":"ok"}' } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    try {
      const content = await chatCompletions(
        config,
        [{ role: "user", content: "Give a title" }],
        { format: TITLE_CARD_SCHEMA, jsonSchemaName: "title_card" }
      );
      expect(parsed?.format).toEqual(TITLE_CARD_SCHEMA);
      expect(parsed?.response_format).toMatchObject({
        type: "json_schema",
        json_schema: { name: "title_card", schema: TITLE_CARD_SCHEMA }
      });
      expect(JSON.parse(content)).toEqual({ title: "ok" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

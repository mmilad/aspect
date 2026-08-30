export type ChatCompletionMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmChatConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export function readLlmChatConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LlmChatConfig | null {
  const baseUrl = env.PROJECTPLANER_LLM_BASE_URL?.replace(/\/$/, "");
  const model = env.PROJECTPLANER_LLM_MODEL;
  if (!baseUrl || !model) {
    return null;
  }
  return { baseUrl, model, apiKey: env.PROJECTPLANER_LLM_API_KEY };
}

/** `"json"` = JSON object; a record = JSON Schema (Ollama `format` / OpenAI `response_format`). */
export type LlmChatFormat = "json" | Record<string, unknown>;

export type ChatCompletionsOptions = {
  temperature?: number;
  /** Omit = free text. `"json"` = JSON object. Object = JSON Schema. */
  format?: LlmChatFormat;
  /** OpenAI json_schema name when `format` is a schema object. */
  jsonSchemaName?: string;
};

export function openAiResponseFormat(
  format: LlmChatFormat,
  jsonSchemaName = "llm_json"
): { type: "json_object" } | { type: "json_schema"; json_schema: { name: string; strict: true; schema: Record<string, unknown> } } {
  if (format === "json") {
    return { type: "json_object" };
  }
  return {
    type: "json_schema",
    json_schema: {
      name: jsonSchemaName,
      strict: true,
      schema: format
    }
  };
}

export function chatCompletionsBody(
  config: LlmChatConfig,
  messages: ChatCompletionMessage[],
  options?: ChatCompletionsOptions
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: options?.temperature ?? 0.2,
    messages
  };
  if (options?.format === undefined) {
    return body;
  }
  body.format = options.format;
  body.response_format = openAiResponseFormat(options.format, options.jsonSchemaName);
  return body;
}

/** OpenAI-compatible chat.completions helper (Ollama /v1, etc.). */
export async function chatCompletions(
  config: LlmChatConfig,
  messages: ChatCompletionMessage[],
  options?: ChatCompletionsOptions
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify(chatCompletionsBody(config, messages, options))
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }
  return content;
}

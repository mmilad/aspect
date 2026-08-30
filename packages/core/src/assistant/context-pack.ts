/** JSON Schema for Turn A standing picture (not `{ text, patch }`). */

export const ASSISTANT_CONTEXT_V1_KEY = "assistant_context_v1";

const topicSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    why: { type: "string" },
    entityId: { type: "string" }
  }
} as const;

const summarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" },
    settled: { type: "array", items: { type: "string" } },
    open: { type: "array", items: { type: "string" } }
  }
} as const;

const contextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectKey"],
  properties: {
    projectKey: { type: "string" },
    flowId: { type: "string" },
    nodeId: { type: "string" },
    entityId: { type: "string" }
  }
} as const;

export const ASSISTANT_CONTEXT_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:assistant_context_v1",
  type: "object",
  additionalProperties: false,
  required: ["summary", "currentTopic", "topics", "context", "topicChanged"],
  properties: {
    summary: summarySchema,
    currentTopic: {
      anyOf: [topicSchema, { type: "null" }]
    },
    topics: { type: "array", items: topicSchema },
    context: contextSchema,
    topicChanged: { type: "boolean" },
    focus: { type: "string" }
  }
};

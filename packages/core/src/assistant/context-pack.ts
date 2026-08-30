/** JSON Schema for Turn A standing picture (not `{ text, patch }`). */

export const ASSISTANT_CONTEXT_V1_KEY = "assistant_context_v1";
export const ASSISTANT_CONTEXT_V2_KEY = "assistant_context_v2";

const topicSchemaV1 = {
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

const summarySchemaV1 = {
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

/** Kept so old paused runs still validate. Preset uses v2. */
export const ASSISTANT_CONTEXT_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:assistant_context_v1",
  type: "object",
  additionalProperties: false,
  required: ["summary", "currentTopic", "topics", "context", "topicChanged"],
  properties: {
    summary: summarySchemaV1,
    currentTopic: {
      anyOf: [topicSchemaV1, { type: "null" }]
    },
    topics: { type: "array", items: topicSchemaV1 },
    context: contextSchema,
    topicChanged: { type: "boolean" },
    focus: { type: "string" }
  }
};

const topicSchemaV2 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "status", "weight"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    status: { type: "string", enum: ["active", "parked"] },
    weight: { type: "number", minimum: 0, maximum: 1 },
    why: { type: "string" },
    entityId: { type: "string" }
  }
} as const;

const questionSchemaV2 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text", "status"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
    status: { type: "string", enum: ["open", "answered"] },
    answer: { type: "string" },
    topicId: { type: "string" }
  }
} as const;

const summarySchemaV2 = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" }
  }
} as const;

export const ASSISTANT_CONTEXT_V2_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:assistant_context_v2",
  type: "object",
  additionalProperties: false,
  required: ["summary", "topics", "questions", "context"],
  properties: {
    summary: summarySchemaV2,
    topics: { type: "array", items: topicSchemaV2 },
    questions: { type: "array", items: questionSchemaV2 },
    context: contextSchema
  }
};

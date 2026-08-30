/** JSON Schema for one assistant turn: reply text + optional session patch. */

export const ASSISTANT_TURN_SCHEMA_NAME = "projectplaner.assistant.turn.v1";

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

export const ASSISTANT_TURN_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:assistant:turn_v1",
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" },
    patch: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: summarySchema,
        currentTopic: {
          anyOf: [topicSchema, { type: "null" }]
        },
        topics: { type: "array", items: topicSchema },
        context: {
          type: "object",
          additionalProperties: false,
          properties: {
            projectKey: { type: "string" },
            flowId: { type: "string" },
            nodeId: { type: "string" },
            entityId: { type: "string" }
          }
        }
      }
    }
  }
};

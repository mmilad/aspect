/** JSON Schema for one assistant turn: reply text + optional session patch. */

export const ASSISTANT_TURN_SCHEMA_NAME = "projectplaner.assistant.turn.v1";

const topicSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    status: { type: "string", enum: ["active", "parked"] },
    weight: { type: "number", minimum: 0, maximum: 1 },
    why: { type: "string" },
    entityId: { type: "string" }
  }
} as const;

const questionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
    status: { type: "string", enum: ["open", "answered"] },
    answer: { type: "string" },
    topicId: { type: "string" }
  }
} as const;

const summarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" }
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
        topics: { type: "array", items: topicSchema },
        questions: { type: "array", items: questionSchema },
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

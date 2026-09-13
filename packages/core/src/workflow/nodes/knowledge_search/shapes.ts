import type { BagShape } from "../_shared/types";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const NULLABLE_NUMBER: BagShape = { kind: "union", options: [NUMBER, { kind: "primitive", type: "null" }] };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const ANY: BagShape = { kind: "any" };

const KNOWLEDGE_SCOPE_SHAPE: BagShape = {
  kind: "object",
  fields: {
    kind: STRING,
    ownerId: STRING,
    projectKey: STRING,
    agentId: STRING,
    sessionId: STRING,
    sourceId: STRING
  },
  requiredFields: ["kind"]
};

/** The normalized, trace-safe shape returned by a knowledge search. */
export const KNOWLEDGE_HIT_SHAPE: BagShape = {
  kind: "object",
  fields: {
    id: STRING,
    datasetKey: STRING,
    rawText: STRING,
    metadata: ANY,
    scope: KNOWLEDGE_SCOPE_SHAPE,
    score: NUMBER,
    vectorScore: NULLABLE_NUMBER,
    keywordScore: NULLABLE_NUMBER,
    embeddingModel: NULLABLE_STRING
  },
  requiredFields: ["id", "datasetKey", "rawText", "metadata", "scope", "score"]
};

export const KNOWLEDGE_HITS_SHAPE: BagShape = {
  kind: "array",
  items: KNOWLEDGE_HIT_SHAPE
};

import type { BagShape } from "../_shared/types";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRING_ARRAY: BagShape = { kind: "array", items: STRING };

export const KNOWLEDGE_CATALOG_DATASET_SHAPE: BagShape = {
  kind: "object",
  fields: {
    key: STRING,
    displayName: STRING,
    llmSummary: NULLABLE_STRING,
    capabilities: STRING_ARRAY,
    entityTypes: STRING_ARRAY,
    accessPatterns: STRING_ARRAY,
    status: STRING
  },
  requiredFields: ["key", "displayName", "capabilities", "entityTypes", "accessPatterns", "status"]
};

export const KNOWLEDGE_CATALOG_TOOL_SHAPE: BagShape = {
  kind: "object",
  fields: {
    key: STRING,
    name: STRING,
    llmSummary: NULLABLE_STRING,
    capabilityTags: STRING_ARRAY,
    status: STRING
  },
  requiredFields: ["key", "name", "capabilityTags", "status"]
};

export const KNOWLEDGE_CATALOG_DATASETS_SHAPE: BagShape = {
  kind: "array",
  items: KNOWLEDGE_CATALOG_DATASET_SHAPE
};

export const KNOWLEDGE_CATALOG_TOOLS_SHAPE: BagShape = {
  kind: "array",
  items: KNOWLEDGE_CATALOG_TOOL_SHAPE
};

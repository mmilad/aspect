/**
 * Centralized JSON Schema presets for LLM `format` (not BagShape).
 * Seeded into llm_json_schemas; generators import the same objects.
 */

export type LlmJsonSchemaPreset = {
  key: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
};

/** Slim step list: LLM emits this; a generator compiles to Workflow Step Graph v2. */
export const WORKFLOW_IR_V1_KEY = "workflow_ir_v1";

export const WORKFLOW_IR_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:workflow_ir_v1",
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    steps: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["start", "end", "llm", "context", "transform", "write", "branch"]
          },
          title: { type: "string", minLength: 1 },
          instructions: { type: "string" }
        },
        required: ["type", "title"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "steps"],
  additionalProperties: false
};

export const LLM_JSON_SCHEMA_PRESETS: LlmJsonSchemaPreset[] = [
  {
    key: WORKFLOW_IR_V1_KEY,
    title: "Workflow IR v1",
    description:
      "Slim step list for a generator that compiles to Workflow Step Graph v2. LLM emits this JSON; a function fills ids, positions, and edges.",
    schema: WORKFLOW_IR_V1_SCHEMA
  }
];

export function getLlmJsonSchemaPreset(key: string): LlmJsonSchemaPreset | undefined {
  return LLM_JSON_SCHEMA_PRESETS.find((preset) => preset.key === key);
}

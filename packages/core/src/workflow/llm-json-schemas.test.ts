import { describe, expect, it } from "vitest";
import {
  LLM_JSON_SCHEMA_PRESETS,
  WORKFLOW_IR_V1_KEY,
  WORKFLOW_IR_V1_SCHEMA,
  getLlmJsonSchemaPreset
} from "./llm-json-schemas";

describe("workflow_ir_v1 JSON Schema preset", () => {
  it("is the catalog entry a generator can import by key", () => {
    expect(getLlmJsonSchemaPreset(WORKFLOW_IR_V1_KEY)?.schema).toEqual(WORKFLOW_IR_V1_SCHEMA);
    expect(LLM_JSON_SCHEMA_PRESETS.map((preset) => preset.key)).toEqual([WORKFLOW_IR_V1_KEY]);
    expect(WORKFLOW_IR_V1_SCHEMA.required).toEqual(["title", "steps"]);
    const steps = (WORKFLOW_IR_V1_SCHEMA.properties as { steps: { items: { properties: { type: { enum: string[] } } } } })
      .steps;
    expect(steps.items.properties.type.enum).toContain("llm");
    expect(steps.items.properties.type.enum).toContain("write");
  });
});

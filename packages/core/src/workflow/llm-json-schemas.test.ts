import { describe, expect, it } from "vitest";
import {
  LLM_JSON_SCHEMA_PRESETS,
  WORKFLOW_IR_V1_KEY,
  WORKFLOW_IR_V1_SCHEMA,
  WORKFLOW_NODE_PLAN_V1_KEY,
  WORKFLOW_NODE_PLAN_V1_SCHEMA,
  WORKFLOW_NODE_QA_V1_KEY,
  WORKFLOW_NODE_QA_V1_SCHEMA,
  WORKFLOW_STEP_DRAFT_V1_KEY,
  WORKFLOW_STEP_DRAFT_V1_SCHEMA,
  WORKFLOW_STEP_LIST_V1_KEY,
  WORKFLOW_STEP_LIST_V1_SCHEMA,
  getLlmJsonSchemaPreset
} from "./llm-json-schemas";

describe("workflow_ir_v1 JSON Schema preset", () => {
  it("is the catalog entry a generator can import by key", () => {
    expect(getLlmJsonSchemaPreset(WORKFLOW_IR_V1_KEY)?.schema).toEqual(WORKFLOW_IR_V1_SCHEMA);
    expect(getLlmJsonSchemaPreset(WORKFLOW_STEP_DRAFT_V1_KEY)?.schema).toEqual(
      WORKFLOW_STEP_DRAFT_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(WORKFLOW_NODE_PLAN_V1_KEY)?.schema).toEqual(
      WORKFLOW_NODE_PLAN_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(WORKFLOW_NODE_QA_V1_KEY)?.schema).toEqual(
      WORKFLOW_NODE_QA_V1_SCHEMA
    );
    expect(LLM_JSON_SCHEMA_PRESETS.map((preset) => preset.key)).toEqual([
      WORKFLOW_IR_V1_KEY,
      WORKFLOW_NODE_PLAN_V1_KEY,
      WORKFLOW_NODE_QA_V1_KEY,
      WORKFLOW_STEP_DRAFT_V1_KEY,
      WORKFLOW_STEP_LIST_V1_KEY
    ]);
    expect(WORKFLOW_IR_V1_SCHEMA.required).toEqual(["title", "steps"]);
    const steps = (WORKFLOW_IR_V1_SCHEMA.properties as { steps: { items: { properties: { type: { enum: string[] } } } } })
      .steps;
    expect(steps.items.properties.type.enum).toContain("llm");
    expect(steps.items.properties.type.enum).toContain("write");
  });

  it("describes a workflow step JSON response", () => {
    expect(WORKFLOW_STEP_DRAFT_V1_SCHEMA.required).toEqual([
      "title",
      "reasoning",
      "reads",
      "writes",
      "fragment",
      "assertions"
    ]);
    const fragment = (WORKFLOW_STEP_DRAFT_V1_SCHEMA.properties as {
      fragment: {
        properties: {
          nodes: { items: { properties: { type: { enum: string[] } } } };
        };
      };
    }).fragment;
    expect(fragment.properties.nodes.items.properties.type.enum).toContain("foreach");
    expect(fragment.properties.nodes.items.properties.type.enum).toContain("math");
    expect(fragment.properties.nodes.items.properties.type.enum).toContain("push");
  });

  it("describes a workflow node plan JSON response", () => {
    expect(WORKFLOW_NODE_PLAN_V1_SCHEMA.required).toEqual(["nodeType", "title", "config"]);
    const properties = WORKFLOW_NODE_PLAN_V1_SCHEMA.properties as {
      nodeType: { enum: string[] };
      config: { type: string };
    };
    expect(properties.nodeType.enum).toContain("foreach");
    expect(properties.nodeType.enum).toContain("math");
    expect(properties.nodeType.enum).toContain("push");
    expect(properties.nodeType.enum).toContain("create_workflow_node");
    expect(properties.config.type).toBe("object");
  });

  it("describes a workflow node QA JSON response", () => {
    expect(WORKFLOW_NODE_QA_V1_SCHEMA.required).toEqual([
      "nodeAccepted",
      "qaReason",
      "repairInstructions",
      "improvements"
    ]);
    const properties = WORKFLOW_NODE_QA_V1_SCHEMA.properties as {
      nodeAccepted: { type: string };
      qaReason: { type: string };
      improvements: { type: string };
    };
    expect(properties.nodeAccepted.type).toBe("boolean");
    expect(properties.qaReason.type).toBe("string");
    expect(properties.improvements.type).toBe("array");
  });

  it("requires at least two unique create_step instructions and no upper bound", () => {
    const properties = WORKFLOW_STEP_LIST_V1_SCHEMA.properties as {
      stepInstructionsList: { minItems: number; maxItems?: number; uniqueItems?: boolean };
    };
    expect(WORKFLOW_STEP_LIST_V1_SCHEMA.required).toEqual(["stepInstructionsList"]);
    expect(properties.stepInstructionsList.minItems).toBe(2);
    expect(properties.stepInstructionsList.maxItems).toBeUndefined();
    expect(properties.stepInstructionsList.uniqueItems).toBe(true);
  });
});

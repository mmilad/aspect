import { describe, expect, it } from "vitest";
import {
  AGENT_PROFILE_V1_KEY,
  ASSISTANT_CONTEXT_V1_KEY,
  ASSISTANT_CONTEXT_V1_SCHEMA,
  ASSISTANT_CONTEXT_V2_KEY,
  ASSISTANT_CONTEXT_V2_SCHEMA,
  LLM_JSON_SCHEMA_PRESETS,
  THOUGHT_ALTERNATIVES_V1_KEY,
  THOUGHT_ALTERNATIVES_V1_SCHEMA,
  THOUGHT_ANALYSIS_V1_KEY,
  THOUGHT_ANALYSIS_V1_SCHEMA,
  THOUGHT_DECISION_V1_KEY,
  THOUGHT_DECISION_V1_SCHEMA,
  THOUGHT_EVALUATION_V1_KEY,
  THOUGHT_EVALUATION_V1_SCHEMA,
  THOUGHT_FINALIZE_V1_KEY,
  THOUGHT_FINALIZE_V1_SCHEMA,
  THOUGHT_REFLECTION_V1_KEY,
  THOUGHT_REFLECTION_V1_SCHEMA,
  THOUGHT_VALIDATION_V1_KEY,
  THOUGHT_VALIDATION_V1_SCHEMA,
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
import { PLAN_V1_KEY, PLAN_V1_SCHEMA } from "../../planning";
import {
  PLAN_CLASSIFY_V1_KEY,
  PLAN_CLASSIFY_V1_SCHEMA,
  PLAN_EXPAND_V1_KEY,
  PLAN_EXPAND_V1_SCHEMA
} from "../../planning";

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
    expect(getLlmJsonSchemaPreset(THOUGHT_ANALYSIS_V1_KEY)?.schema).toEqual(
      THOUGHT_ANALYSIS_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(THOUGHT_VALIDATION_V1_KEY)?.schema).toEqual(
      THOUGHT_VALIDATION_V1_SCHEMA
    );
    expect(LLM_JSON_SCHEMA_PRESETS.map((preset) => preset.key)).toEqual([
      AGENT_PROFILE_V1_KEY,
      WORKFLOW_IR_V1_KEY,
      WORKFLOW_NODE_PLAN_V1_KEY,
      WORKFLOW_NODE_QA_V1_KEY,
      WORKFLOW_STEP_DRAFT_V1_KEY,
      WORKFLOW_STEP_LIST_V1_KEY,
      THOUGHT_ANALYSIS_V1_KEY,
      THOUGHT_ALTERNATIVES_V1_KEY,
      THOUGHT_EVALUATION_V1_KEY,
      THOUGHT_DECISION_V1_KEY,
      THOUGHT_VALIDATION_V1_KEY,
      THOUGHT_REFLECTION_V1_KEY,
      THOUGHT_FINALIZE_V1_KEY,
      ASSISTANT_CONTEXT_V1_KEY,
      ASSISTANT_CONTEXT_V2_KEY,
      PLAN_V1_KEY,
      PLAN_CLASSIFY_V1_KEY,
      PLAN_EXPAND_V1_KEY
    ]);
    expect(WORKFLOW_IR_V1_SCHEMA.required).toEqual(["title", "steps"]);
    const steps = (WORKFLOW_IR_V1_SCHEMA.properties as { steps: { items: { properties: { type: { enum: string[] } } } } })
      .steps;
    expect(steps.items.properties.type.enum).toContain("llm");
    expect(steps.items.properties.type.enum).toContain("write");
  });

  it("describes thinking workflow JSON responses by output port", () => {
    expect(getLlmJsonSchemaPreset(THOUGHT_ALTERNATIVES_V1_KEY)?.schema).toEqual(
      THOUGHT_ALTERNATIVES_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(THOUGHT_EVALUATION_V1_KEY)?.schema).toEqual(
      THOUGHT_EVALUATION_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(THOUGHT_DECISION_V1_KEY)?.schema).toEqual(
      THOUGHT_DECISION_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(THOUGHT_REFLECTION_V1_KEY)?.schema).toEqual(
      THOUGHT_REFLECTION_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(THOUGHT_FINALIZE_V1_KEY)?.schema).toEqual(
      THOUGHT_FINALIZE_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(PLAN_V1_KEY)?.schema).toEqual(PLAN_V1_SCHEMA);
    expect(getLlmJsonSchemaPreset(PLAN_CLASSIFY_V1_KEY)?.schema).toEqual(PLAN_CLASSIFY_V1_SCHEMA);
    expect(getLlmJsonSchemaPreset(PLAN_EXPAND_V1_KEY)?.schema).toEqual(PLAN_EXPAND_V1_SCHEMA);
    expect(getLlmJsonSchemaPreset(ASSISTANT_CONTEXT_V1_KEY)?.schema).toEqual(
      ASSISTANT_CONTEXT_V1_SCHEMA
    );
    expect(getLlmJsonSchemaPreset(ASSISTANT_CONTEXT_V2_KEY)?.schema).toEqual(
      ASSISTANT_CONTEXT_V2_SCHEMA
    );

    const analysis = THOUGHT_ANALYSIS_V1_SCHEMA.properties as {
      analysisTrace: { properties: { kind: { const: string }; nodeId: { const: string } } };
    };
    expect(analysis.analysisTrace.properties.kind.const).toBe("analysis");
    expect(analysis.analysisTrace.properties.nodeId.const).toBe("understand");

    const decision = THOUGHT_DECISION_V1_SCHEMA.properties as {
      decision: { required: string[]; properties: { confidence: { minimum: number; maximum: number } } };
    };
    expect(decision.decision.required).toContain("reason");
    expect(decision.decision.required).toContain("result");
    expect(decision.decision.properties.confidence.minimum).toBe(0);
    expect(decision.decision.properties.confidence.maximum).toBe(1);
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
    expect(fragment.properties.nodes.items.properties.type.enum).toContain("query");
    expect(fragment.properties.nodes.items.properties.type.enum).toContain("push");
    expect(fragment.properties.nodes.items.properties.type.enum).toContain("template");
  });

  it("describes a workflow node plan JSON response", () => {
    expect(WORKFLOW_NODE_PLAN_V1_SCHEMA.required).toEqual(["nodeType", "title", "config"]);
    const properties = WORKFLOW_NODE_PLAN_V1_SCHEMA.properties as {
      nodeType: { enum: string[] };
      config: { type: string };
    };
    expect(properties.nodeType.enum).toContain("foreach");
    expect(properties.nodeType.enum).toContain("math");
    expect(properties.nodeType.enum).toContain("query");
    expect(properties.nodeType.enum).toContain("push");
    expect(properties.nodeType.enum).toContain("create_workflow_node");
    expect(properties.nodeType.enum).toContain("template");
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

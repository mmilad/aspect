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

/** Slim step list: LLM emits this; a generator compiles to Workflow Step Graph v4. */
export const WORKFLOW_IR_V1_KEY = "workflow_ir_v1";
export const WORKFLOW_NODE_PLAN_V1_KEY = "workflow_node_plan_v1";
export const WORKFLOW_NODE_QA_V1_KEY = "workflow_node_qa_v1";
export const WORKFLOW_STEP_DRAFT_V1_KEY = "workflow_step_draft_v1";
export const WORKFLOW_STEP_LIST_V1_KEY = "workflow_step_list_v1";

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

export const WORKFLOW_STEP_DRAFT_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:workflow_step_draft_v1",
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    summary: { type: "string" },
    reasoning: { type: "string" },
    reads: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true
    },
    writes: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true
    },
    fragment: {
      type: "object",
      properties: {
        entryNodeId: { type: "string", minLength: 1 },
        exitNodeIds: {
          type: "array",
          items: { type: "string", minLength: 1 },
          uniqueItems: true
        },
        nodes: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              type: {
                type: "string",
                enum: [
                  "branch",
                  "switch",
                  "foreach",
                  "tool",
                  "llm",
                  "context",
                  "transform",
                  "map",
                  "math",
                  "write",
                  "push",
                  "subworkflow",
                  "wait"
                ]
              },
              title: { type: "string", minLength: 1 },
              data: { type: "object", additionalProperties: true }
            },
            required: ["id", "type", "title", "data"],
            additionalProperties: false
          }
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", minLength: 1 },
              source: { type: "string", minLength: 1 },
              target: { type: "string", minLength: 1 },
              kind: {
                type: "string",
                enum: ["next", "route", "depends_on", "error"]
              },
              sourcePin: { type: "string", minLength: 1 },
              targetPin: { type: "string", minLength: 1 },
              label: { type: "string" }
            },
            required: ["id", "source", "target", "kind"],
            additionalProperties: false
          }
        }
      },
      required: ["entryNodeId", "exitNodeIds", "nodes", "edges"],
      additionalProperties: false
    },
    assertions: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  },
  required: ["title", "reasoning", "reads", "writes", "fragment", "assertions"],
  additionalProperties: false
};

export const WORKFLOW_NODE_PLAN_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:workflow_node_plan_v1",
  type: "object",
  properties: {
    nodeType: {
      type: "string",
      enum: [
        "start",
        "end",
        "error_end",
        "branch",
        "switch",
        "fork",
        "join",
        "foreach",
        "gate",
        "wait",
        "subworkflow",
        "tool",
        "llm",
        "context",
        "transform",
        "map",
        "math",
        "write",
        "push",
        "create_workflow_node"
      ]
    },
    id: { type: "string" },
    title: { type: "string", minLength: 1 },
    purpose: { type: "string" },
    reads: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true
    },
    writes: {
      type: "array",
      items: { type: "string", minLength: 1 },
      uniqueItems: true
    },
    inputs: { type: "object", additionalProperties: true },
    outputContracts: { type: "object", additionalProperties: true },
    inputBindings: { type: "object", additionalProperties: { type: "string" } },
    writeBindings: { type: "object", additionalProperties: { type: "string" } },
    position: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["x", "y"],
      additionalProperties: false
    },
    config: { type: "object", additionalProperties: true }
  },
  required: ["nodeType", "title", "config"],
  additionalProperties: false
};

export const WORKFLOW_NODE_QA_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:workflow_node_qa_v1",
  type: "object",
  properties: {
    nodeAccepted: { type: "boolean" },
    qaReason: { type: "string", minLength: 1 },
    repairInstructions: { type: "string" },
    improvements: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  },
  required: ["nodeAccepted", "qaReason", "repairInstructions", "improvements"],
  additionalProperties: false
};

export const WORKFLOW_STEP_LIST_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:workflow_step_list_v1",
  type: "object",
  properties: {
    stepInstructionsList: {
      type: "array",
      minItems: 2,
      uniqueItems: true,
      items: { type: "string", minLength: 1 }
    }
  },
  required: ["stepInstructionsList"],
  additionalProperties: false
};

export const LLM_JSON_SCHEMA_PRESETS: LlmJsonSchemaPreset[] = [
  {
    key: WORKFLOW_IR_V1_KEY,
    title: "Workflow IR v1",
    description:
      "Slim step list for a generator that compiles to Workflow Step Graph v4. LLM emits this JSON; a function fills ids, positions, and edges.",
    schema: WORKFLOW_IR_V1_SCHEMA
  },
  {
    key: WORKFLOW_NODE_PLAN_V1_KEY,
    title: "Workflow Node Plan v1",
    description:
      "Intent-level plan for one workflow node. LLM emits this JSON; create_workflow_node materializes and validates it.",
    schema: WORKFLOW_NODE_PLAN_V1_SCHEMA
  },
  {
    key: WORKFLOW_NODE_QA_V1_KEY,
    title: "Workflow Node QA v1",
    description:
      "Verifier result for one materialized workflow node. LLM emits acceptance, reason, repair instructions, and improvements.",
    schema: WORKFLOW_NODE_QA_V1_SCHEMA
  },
  {
    key: WORKFLOW_STEP_DRAFT_V1_KEY,
    title: "Workflow Step Draft v1",
    description:
      "Structured graph fragment for one workflow step. LLM emits this JSON; create_workflow can validate and insert the fragment.",
    schema: WORKFLOW_STEP_DRAFT_V1_SCHEMA
  },
  {
    key: WORKFLOW_STEP_LIST_V1_KEY,
    title: "Workflow Step List v1",
    description:
      "Ordered create_step instructions for create_workflow. At least two unique strings; no upper bound. Foreach runs create_step for each string.",
    schema: WORKFLOW_STEP_LIST_V1_SCHEMA
  }
];

export function getLlmJsonSchemaPreset(key: string): LlmJsonSchemaPreset | undefined {
  return LLM_JSON_SCHEMA_PRESETS.find((preset) => preset.key === key);
}

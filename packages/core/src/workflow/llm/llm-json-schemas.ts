/**
 * Centralized JSON Schema presets for LLM `format` (not BagShape).
 * Seeded into llm_json_schemas; generators import the same objects.
 */

import {
  ASSISTANT_CONTEXT_V1_KEY,
  ASSISTANT_CONTEXT_V1_SCHEMA,
  ASSISTANT_CONTEXT_V2_KEY,
  ASSISTANT_CONTEXT_V2_SCHEMA
} from "../../assistant/context-pack";
import { PLAN_CLASSIFY_V1_KEY, PLAN_CLASSIFY_V1_SCHEMA, PLAN_EXPAND_V1_KEY, PLAN_EXPAND_V1_SCHEMA } from "../../planning";
import { PLAN_V1_KEY, PLAN_V1_SCHEMA } from "../../planning";

export {
  ASSISTANT_CONTEXT_V1_KEY,
  ASSISTANT_CONTEXT_V1_SCHEMA,
  ASSISTANT_CONTEXT_V2_KEY,
  ASSISTANT_CONTEXT_V2_SCHEMA
};

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
export const THOUGHT_ANALYSIS_V1_KEY = "thought_analysis_v1";
export const THOUGHT_ALTERNATIVES_V1_KEY = "thought_alternatives_v1";
export const THOUGHT_EVALUATION_V1_KEY = "thought_evaluation_v1";
export const THOUGHT_DECISION_V1_KEY = "thought_decision_v1";
export const THOUGHT_VALIDATION_V1_KEY = "thought_validation_v1";
export const THOUGHT_REFLECTION_V1_KEY = "thought_reflection_v1";
export const THOUGHT_FINALIZE_V1_KEY = "thought_finalize_v1";
export const AGENT_PROFILE_V1_KEY = "agent_profile_v1";
export const AGENT_PROFILE_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:agent_profile_v1",
  type: "object",
  properties: {
    kind: { type: "string", enum: ["assistant", "specialist"] },
    role: { type: "string" },
    responsibilities: { type: "array", items: { type: "string" } },
    recurringActivities: { type: "array", items: { type: "string" } },
    capabilities: { type: "array", items: { type: "string" } },
    decisionAreas: { type: "array", items: { type: "string" } },
    candidateWorkflows: { type: "array", items: { type: "string" } },
    assignedWorkflowIds: { type: "array", items: { type: "string" } },
    contextPolicy: {
      type: "object",
      properties: {
        graphEnabled: { type: "boolean" },
        memoryEnabled: { type: "boolean" },
        maxResults: { type: "integer", minimum: 1 },
        maxContextTokens: { type: "integer", minimum: 1 }
      },
      additionalProperties: false
    },
    memoryPolicy: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        scope: { type: "string", enum: ["global", "personal", "project", "agent", "session"] }
      },
      additionalProperties: false
    },
    instructions: { type: "string" },
    history: { type: "array", items: { type: "object" } }
  },
  required: ["role", "responsibilities", "recurringActivities", "capabilities", "decisionAreas", "candidateWorkflows", "instructions", "history"],
  additionalProperties: false
};
export const AGENT_DECISION_V1_KEY = "agent_decision_v1";
export const AGENT_DECISION_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:agent_decision_v1",
  type: "object",
  additionalProperties: false,
  required: ["type", "result", "summary", "question", "workflowId", "bag", "name", "args"],
  properties: {
    type: { type: "string", enum: ["complete", "clarification", "workflow", "capability"] },
    result: { type: ["string", "null"] },
    summary: { type: ["string", "null"] },
    question: { type: ["string", "null"] },
    workflowId: { type: ["string", "null"] },
    bag: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    name: { type: ["string", "null"] },
    args: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] }
  }
};
export const KNOWLEDGE_CLASSIFICATION_V1_KEY = "knowledge_classification_v1";
export const KNOWLEDGE_CLASSIFICATION_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:knowledge_classification_v1",
  type: "object",
  additionalProperties: false,
  required: ["decision", "kind", "confidence", "canonicalText", "sourceQuote", "suggestedDatasetKey", "suggestedScope", "needsConfirmation", "reason"],
  properties: {
    decision: { type: "string", enum: ["ignore", "candidate", "durable"] },
    kind: { type: "string", enum: ["fact", "preference", "decision", "constraint", "task", "event", "reference", "other"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    canonicalText: { type: "string" },
    sourceQuote: { type: "string" },
    suggestedDatasetKey: { type: ["string", "null"] },
    suggestedScope: { type: "string", enum: ["session", "personal", "project", "agent", "global"] },
    needsConfirmation: { type: "boolean" },
    reason: { type: "string" }
  }
};
export const ASSISTANT_ROUTE_V1_KEY = "assistant_route_v1";
export const ASSISTANT_ROUTE_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:assistant_route_v1",
  type: "object",
  additionalProperties: false,
  required: ["route", "reason", "question", "lookup", "lookupKind", "lookupQuery", "lookupId", "agentId", "task", "runId", "message"],
  properties: {
    route: { type: "string", enum: ["reply", "clarify", "retrieve", "delegate", "resume"] },
    reason: { type: "string" },
    question: { type: ["string", "null"] },
    lookup: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
            required: ["kind", "query", "id"],
            properties: {
              kind: { type: "string", enum: ["agents", "agent", "entities", "entity", "workflows", "neighborhood", "knowledge_catalog", "knowledge", "files", "file"] },
              query: { type: ["string", "null"] },
              id: { type: ["string", "null"] },
              datasetKey: { type: "string" }
          }
        },
        { type: "null" }
      ]
    },
  lookupKind: { type: ["string", "null"], enum: ["agents", "agent", "entities", "entity", "workflows", "neighborhood", "knowledge_catalog", "knowledge", "files", "file", null] },
      lookupQuery: { type: ["string", "null"] },
      lookupId: { type: ["string", "null"] },
      lookupDatasetKey: { type: "string" },
    agentId: { type: ["string", "null"] },
    task: { type: ["string", "null"] },
    runId: { type: ["string", "null"] },
    message: { type: ["string", "null"] }
  }
};

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
            enum: ["start", "end", "llm", "context", "transform", "write", "branch", "delegate"]
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
                  "delegate",
                  "llm",
                  "context",
                  "transform",
                  "map",
                  "math",
                  "query",
                  "write",
                  "push",
                  "assistant_session",
                  "template",
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
        "delegate",
        "llm",
        "context",
        "transform",
        "map",
        "math",
        "query",
        "write",
        "push",
        "create_workflow_node",
        "assistant_session",
        "template"
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

const CONFIDENCE_SCHEMA = { type: "number", minimum: 0, maximum: 1 };
const STRING_ARRAY_SCHEMA = {
  type: "array",
  items: { type: "string", minLength: 1 }
};
const REJECTED_ALTERNATIVE_SCHEMA = {
  type: "object",
  properties: {
    alternative: { type: "string", minLength: 1 },
    reason: { type: "string", minLength: 1 }
  },
  required: ["alternative", "reason"],
  additionalProperties: false
};
const THOUGHT_DECISION_SCHEMA = {
  type: "object",
  properties: {
    result: {},
    decision: { type: "string", minLength: 1 },
    accepted: { type: "boolean" },
    reason: { type: "string", minLength: 1 },
    evidence: STRING_ARRAY_SCHEMA,
    confidence: CONFIDENCE_SCHEMA,
    rejectedAlternatives: {
      type: "array",
      items: REJECTED_ALTERNATIVE_SCHEMA
    },
    issues: STRING_ARRAY_SCHEMA,
    nextAction: { type: "string", minLength: 1 }
  },
  required: [
    "result",
    "decision",
    "accepted",
    "reason",
    "evidence",
    "confidence",
    "rejectedAlternatives",
    "issues",
    "nextAction"
  ],
  additionalProperties: false
};
const THOUGHT_VALIDATION_SCHEMA = {
  type: "object",
  properties: {
    accepted: { type: "boolean" },
    reason: { type: "string", minLength: 1 },
    issues: STRING_ARRAY_SCHEMA,
    confidence: CONFIDENCE_SCHEMA,
    recommendedAction: { type: "string" }
  },
  required: ["accepted", "reason", "issues", "confidence", "recommendedAction"],
  additionalProperties: false
};

function traceEntrySchema(kind: string, nodeId: string): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      id: { type: "string", minLength: 1 },
      iteration: { type: "number", minimum: 1 },
      nodeId: { const: nodeId },
      kind: { const: kind },
      summary: { type: "string", minLength: 1 },
      reason: { type: "string", minLength: 1 },
      evidence: STRING_ARRAY_SCHEMA,
      confidence: CONFIDENCE_SCHEMA,
      createdAt: { type: "string", minLength: 1 }
    },
    required: [
      "id",
      "iteration",
      "nodeId",
      "kind",
      "summary",
      "reason",
      "evidence",
      "confidence",
      "createdAt"
    ],
    additionalProperties: false
  };
}

export const THOUGHT_ANALYSIS_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_analysis_v1",
  type: "object",
  properties: {
    analysis: {},
    analysisTrace: traceEntrySchema("analysis", "understand")
  },
  required: ["analysis", "analysisTrace"],
  additionalProperties: false
};

export const THOUGHT_ALTERNATIVES_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_alternatives_v1",
  type: "object",
  properties: {
    alternatives: {
      type: "array",
      minItems: 1,
      items: {}
    },
    alternativesTrace: traceEntrySchema("alternatives", "generate_alternatives")
  },
  required: ["alternatives", "alternativesTrace"],
  additionalProperties: false
};

export const THOUGHT_EVALUATION_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_evaluation_v1",
  type: "object",
  properties: {
    evaluation: {},
    evaluationTrace: traceEntrySchema("evaluation", "evaluate")
  },
  required: ["evaluation", "evaluationTrace"],
  additionalProperties: false
};

export const THOUGHT_DECISION_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_decision_v1",
  type: "object",
  properties: {
    decision: THOUGHT_DECISION_SCHEMA,
    decisionTrace: traceEntrySchema("decision", "decide")
  },
  required: ["decision", "decisionTrace"],
  additionalProperties: false
};

export const THOUGHT_VALIDATION_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_validation_v1",
  type: "object",
  properties: {
    validation: THOUGHT_VALIDATION_SCHEMA,
    validationTrace: traceEntrySchema("validation", "validate")
  },
  required: ["validation", "validationTrace"],
  additionalProperties: false
};

export const THOUGHT_REFLECTION_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_reflection_v1",
  type: "object",
  properties: {
    reflection: {},
    reflectionTrace: traceEntrySchema("reflection", "reflect")
  },
  required: ["reflection", "reflectionTrace"],
  additionalProperties: false
};

export const THOUGHT_FINALIZE_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:thought_finalize_v1",
  type: "object",
  properties: {
    result: {},
    iterations: { type: "number", minimum: 1 }
  },
  required: ["result", "iterations"],
  additionalProperties: false
};

export const LLM_JSON_SCHEMA_PRESETS: LlmJsonSchemaPreset[] = [
  { key: AGENT_PROFILE_V1_KEY, title: "Agent Profile v1", description: "Structured role profile.", schema: AGENT_PROFILE_V1_SCHEMA },
  { key: AGENT_DECISION_V1_KEY, title: "Agent decision v1", description: "Structured specialist-agent decision.", schema: AGENT_DECISION_V1_SCHEMA },
  { key: KNOWLEDGE_CLASSIFICATION_V1_KEY, title: "Knowledge classification v1", description: "Non-mutating proposal for classifying a source item before promotion.", schema: KNOWLEDGE_CLASSIFICATION_V1_SCHEMA },
  { key: ASSISTANT_ROUTE_V1_KEY, title: "Assistant route v1", description: "Structured Assistant route and request.", schema: ASSISTANT_ROUTE_V1_SCHEMA },
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
  },
  {
    key: THOUGHT_ANALYSIS_V1_KEY,
    title: "Thought Analysis v1",
    description: "Thinking workflow analysis output plus one compact semantic trace entry.",
    schema: THOUGHT_ANALYSIS_V1_SCHEMA
  },
  {
    key: THOUGHT_ALTERNATIVES_V1_KEY,
    title: "Thought Alternatives v1",
    description: "Thinking workflow candidate alternatives output plus one compact semantic trace entry.",
    schema: THOUGHT_ALTERNATIVES_V1_SCHEMA
  },
  {
    key: THOUGHT_EVALUATION_V1_KEY,
    title: "Thought Evaluation v1",
    description: "Thinking workflow alternatives evaluation output plus one compact semantic trace entry.",
    schema: THOUGHT_EVALUATION_V1_SCHEMA
  },
  {
    key: THOUGHT_DECISION_V1_KEY,
    title: "Thought Decision v1",
    description: "Thinking workflow final decision object plus one compact semantic trace entry.",
    schema: THOUGHT_DECISION_V1_SCHEMA
  },
  {
    key: THOUGHT_VALIDATION_V1_KEY,
    title: "Thought Validation v1",
    description: "Thinking workflow validation result plus one compact semantic trace entry.",
    schema: THOUGHT_VALIDATION_V1_SCHEMA
  },
  {
    key: THOUGHT_REFLECTION_V1_KEY,
    title: "Thought Reflection v1",
    description: "Thinking workflow rejection reflection plus one compact semantic trace entry.",
    schema: THOUGHT_REFLECTION_V1_SCHEMA
  },
  {
    key: THOUGHT_FINALIZE_V1_KEY,
    title: "Thought Finalize v1",
    description: "Thinking workflow accepted result and iteration count.",
    schema: THOUGHT_FINALIZE_V1_SCHEMA
  },
  {
    key: ASSISTANT_CONTEXT_V1_KEY,
    title: "Assistant context pack v1",
    description:
      "Legacy standing picture (currentTopic + topicChanged). Kept so old paused runs still validate.",
    schema: ASSISTANT_CONTEXT_V1_SCHEMA
  },
  {
    key: ASSISTANT_CONTEXT_V2_KEY,
    title: "Assistant context pack v2",
    description:
      "Standing picture for one assistant turn: summary, weighted topics (active|parked), questions (open|answered), context.",
    schema: ASSISTANT_CONTEXT_V2_SCHEMA
  },
  {
    key: PLAN_V1_KEY,
    title: "Plan document v1",
    description:
      "Queryable planning document (plans/tasks/todos, questions, decisions, trace, stop). Classify before expand; not a chat transcript.",
    schema: PLAN_V1_SCHEMA
  },
  {
    key: PLAN_CLASSIFY_V1_KEY,
    title: "Plan classify v1",
    description:
      "LLM write that classifies one plan frontier node (atomic / question / decision / subplan / dropped).",
    schema: PLAN_CLASSIFY_V1_SCHEMA
  },
  {
    key: PLAN_EXPAND_V1_KEY,
    title: "Plan expand v1",
    description:
      "LLM write that expands a needs_subplan parent into 3–8 child drafts. Runner mints ids; titles must not restate the parent.",
    schema: PLAN_EXPAND_V1_SCHEMA
  }
];

export function getLlmJsonSchemaPreset(key: string): LlmJsonSchemaPreset | undefined {
  return LLM_JSON_SCHEMA_PRESETS.find((preset) => preset.key === key);
}

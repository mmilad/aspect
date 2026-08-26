import {
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode
} from "../types";
import {
  THOUGHT_ALTERNATIVES_V1_KEY,
  THOUGHT_ANALYSIS_V1_KEY,
  THOUGHT_DECISION_V1_KEY,
  THOUGHT_EVALUATION_V1_KEY,
  THOUGHT_FINALIZE_V1_KEY,
  THOUGHT_REFLECTION_V1_KEY,
  THOUGHT_VALIDATION_V1_KEY
} from "../llm-json-schemas";
import type { WorkflowPreset } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
const JSON_SHAPE = { kind: "any" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };
const TRACE_ENTRY = {
  kind: "object" as const,
  requiredFields: ["id", "iteration", "nodeId", "kind", "summary", "reason", "createdAt"],
  fields: {
    id: STRING,
    iteration: NUMBER,
    nodeId: STRING,
    kind: STRING,
    summary: STRING,
    reason: STRING,
    evidence: STRING_ARRAY,
    confidence: NUMBER,
    createdAt: STRING
  }
};
const TRACE = { kind: "array" as const, items: TRACE_ENTRY };
const REJECTED_ALTERNATIVE = {
  kind: "object" as const,
  requiredFields: ["alternative", "reason"],
  fields: {
    alternative: STRING,
    reason: STRING
  }
};
const THOUGHT_DECISION = {
  kind: "object" as const,
  requiredFields: [
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
  fields: {
    result: JSON_SHAPE,
    decision: STRING,
    accepted: BOOLEAN,
    reason: STRING,
    evidence: STRING_ARRAY,
    confidence: NUMBER,
    rejectedAlternatives: { kind: "array" as const, items: REJECTED_ALTERNATIVE },
    issues: STRING_ARRAY,
    nextAction: STRING
  }
};
const THOUGHT_VALIDATION = {
  kind: "object" as const,
  requiredFields: ["accepted", "reason", "issues", "confidence"],
  fields: {
    accepted: BOOLEAN,
    reason: STRING,
    issues: STRING_ARRAY,
    confidence: NUMBER,
    recommendedAction: STRING
  }
};
const THINKING_SYSTEM_PROMPT = [
  "You are a careful Projectplaner thinking step.",
  "Return only JSON that matches the selected response schema.",
  "Use only the declared inputs and explicit uncertainty; do not invent external facts.",
  "Do not include private chain-of-thought. Trace entries are compact semantic audit records: summary, reason, evidence, confidence, createdAt, iteration.",
  "Keep confidence between 0 and 1. Use ISO timestamps for createdAt."
].join("\n");

function data(
  id: string,
  source: string,
  sourcePin: string,
  target: string,
  targetPin: string
): WorkflowEdge {
  return { id, source, target, kind: "data", sourcePin, targetPin };
}

function inputContracts(reads: string[]): WorkflowNode["data"]["inputs"] {
  const optionalReads = new Set(["context", "constraints", "capabilities", "maxIterations", "decision", "validation", "reflection", "trace"]);
  return Object.fromEntries(
    reads.map((key) => [key, { required: !optionalReads.has(key), shape: JSON_SHAPE }])
  );
}

function outputShape(key: string) {
  if (key === "decision") {
    return THOUGHT_DECISION;
  }
  if (key === "validation") {
    return THOUGHT_VALIDATION;
  }
  if (key === "iterations") {
    return NUMBER;
  }
  if (key.endsWith("Trace")) {
    return TRACE_ENTRY;
  }
  return JSON_SHAPE;
}

function llm(
  id: string,
  title: string,
  x: number,
  reads: string[],
  writes: string[],
  schemaKey: string,
  instructions: string
): WorkflowNode {
  return {
    id,
    type: "llm",
    position: { x, y: 160 },
    data: {
      title,
      inputs: inputContracts(reads),
      outputContracts: Object.fromEntries(
        writes.map((key) => [key, { required: true, shape: outputShape(key) }])
      ),
      llm: {
        systemPrompt: THINKING_SYSTEM_PROMPT,
        schemaKey,
        inputKeys: reads,
        outputSchema: writes,
        instructions
      }
    }
  };
}

function push(id: string, title: string, x: number, valueFrom: string): WorkflowNode {
  return {
    id,
    type: "push",
    position: { x, y: 300 },
    data: {
      title,
      inputs: {
        trace: { required: false, shape: TRACE },
        [valueFrom]: { required: true, shape: TRACE_ENTRY }
      },
      outputContracts: {
        trace: { required: true, shape: TRACE }
      },
      push: { target: "trace", valueFrom }
    }
  };
}

export const thinkingGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "task", role: "input", shape: STRING, required: true },
    { name: "context", role: "input", shape: JSON_SHAPE, required: false },
    { name: "constraints", role: "input", shape: STRING_ARRAY, required: false },
    { name: "expectedOutput", role: "input", shape: JSON_SHAPE, required: true },
    { name: "capabilities", role: "input", shape: JSON_SHAPE, required: false },
    { name: "maxIterations", role: "input", shape: NUMBER, required: false },
    { name: "result", role: "output", shape: JSON_SHAPE, required: true },
    { name: "decision", role: "output", shape: THOUGHT_DECISION, required: true },
    { name: "validation", role: "output", shape: THOUGHT_VALIDATION, required: true },
    { name: "trace", role: "output", shape: TRACE, required: true },
    { name: "iterations", role: "output", shape: NUMBER, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 160 },
      data: { title: "Start" }
    },
    {
      id: "init",
      type: "transform",
      position: { x: 280, y: 160 },
      data: {
        title: "Initialize trace",
        outputContracts: { trace: { required: true, shape: TRACE } },
        auto: { assign: { set: { trace: [] } } }
      }
    },
    llm(
      "understand",
      "Understand task",
      540,
      ["task", "context", "constraints", "expectedOutput", "capabilities", "maxIterations", "decision", "validation", "reflection", "trace"],
      ["analysis", "analysisTrace"],
      THOUGHT_ANALYSIS_V1_KEY,
      [
        "Analyze the thinking task, available context, constraints, expected output, capabilities, and any feedback from a previous attempt.",
        "Return analysis plus analysisTrace. analysisTrace.kind must be analysis and nodeId must be understand.",
        "Keep the trace entry compact: summary, reason, evidence, confidence, createdAt, and iteration.",
        "Task: {{task}}",
        "Context: {{context}}",
        "Constraints: {{constraints}}",
        "Expected output: {{expectedOutput}}",
        "Capabilities: {{capabilities}}",
        "Max iterations: {{maxIterations}}",
        "Previous decision: {{decision}}",
        "Previous validation: {{validation}}",
        "Previous reflection: {{reflection}}",
        "Trace so far: {{trace}}"
      ].join("\n")
    ),
    push("trace_analysis", "Trace analysis", 800, "analysisTrace"),
    llm(
      "generate_alternatives",
      "Generate alternatives",
      1060,
      ["task", "context", "constraints", "expectedOutput", "analysis", "reflection"],
      ["alternatives", "alternativesTrace"],
      THOUGHT_ALTERNATIVES_V1_KEY,
      [
        "Generate one or more candidate solutions. Explain why each could solve the task.",
        "Return alternatives plus alternativesTrace. alternativesTrace.kind must be alternatives and nodeId must be generate_alternatives.",
        "Task: {{task}}",
        "Analysis: {{analysis}}",
        "Reflection from previous attempt: {{reflection}}"
      ].join("\n")
    ),
    push("trace_alternatives", "Trace alternatives", 1320, "alternativesTrace"),
    llm(
      "evaluate",
      "Evaluate alternatives",
      1580,
      ["task", "context", "constraints", "expectedOutput", "analysis", "alternatives"],
      ["evaluation", "evaluationTrace"],
      THOUGHT_EVALUATION_V1_KEY,
      [
        "Compare the alternatives against the task, context, constraints, and expected output.",
        "Include advantages, disadvantages, risks, missing information, and the reason for the evaluation.",
        "Return evaluation plus evaluationTrace. evaluationTrace.kind must be evaluation and nodeId must be evaluate.",
        "Alternatives: {{alternatives}}"
      ].join("\n")
    ),
    push("trace_evaluation", "Trace evaluation", 1840, "evaluationTrace"),
    llm(
      "decide",
      "Decide",
      2100,
      ["task", "context", "constraints", "expectedOutput", "analysis", "alternatives", "evaluation"],
      ["decision", "decisionTrace"],
      THOUGHT_DECISION_V1_KEY,
      [
        "Choose the best result and return a full decision object, never just a label or boolean.",
        "decision.reason is required. confidence must be a number between 0 and 1.",
        "decision.result must be structurally usable as the requested expected output.",
        "Return decision plus decisionTrace. decisionTrace.kind must be decision and nodeId must be decide.",
        "Evaluation: {{evaluation}}"
      ].join("\n")
    ),
    push("trace_decision", "Trace decision", 2360, "decisionTrace"),
    llm(
      "validate",
      "Validate decision",
      2620,
      ["task", "context", "constraints", "expectedOutput", "decision"],
      ["validation", "validationTrace"],
      THOUGHT_VALIDATION_V1_KEY,
      [
        "Validate the decision. Separate deterministic contract or shape concerns from semantic judgement.",
        "Check required fields, reason, confidence, explicit constraints, unresolved blockers, and structural usability of result.",
        "Return validation plus validationTrace. validationTrace.kind must be validation and nodeId must be validate.",
        "The route after this step uses only validation.accepted.",
        "Decision: {{decision}}"
      ].join("\n")
    ),
    push("trace_validation", "Trace validation", 2880, "validationTrace"),
    {
      id: "accepted",
      type: "branch",
      position: { x: 3140, y: 160 },
      data: {
        title: "Accepted?",
        inputs: {
          validation: { required: true, shape: THOUGHT_VALIDATION }
        },
        branch: { on: "validation.accepted" }
      }
    },
    llm(
      "reflect",
      "Reflect",
      3400,
      ["task", "analysis", "alternatives", "evaluation", "decision", "validation", "trace"],
      ["reflection", "reflectionTrace"],
      THOUGHT_REFLECTION_V1_KEY,
      [
        "The decision was rejected. Explain why, which assumption or conclusion was wrong, and what must change next time.",
        "Return reflection plus reflectionTrace. reflectionTrace.kind must be reflection and nodeId must be reflect.",
        "Validation: {{validation}}",
        "Decision: {{decision}}",
        "Trace so far: {{trace}}"
      ].join("\n")
    ),
    push("trace_reflection", "Trace reflection", 3660, "reflectionTrace"),
    llm(
      "finalize",
      "Finalize",
      3400,
      ["decision", "validation", "trace"],
      ["result", "iterations"],
      THOUGHT_FINALIZE_V1_KEY,
      [
        "Finalize only an accepted decision. Return result as decision.result and iterations as the highest iteration represented in trace.",
        "Decision: {{decision}}",
        "Validation: {{validation}}",
        "Trace: {{trace}}"
      ].join("\n")
    ),
    {
      id: "end",
      type: "end",
      position: { x: 3920, y: 160 },
      data: { title: "End" }
    }
  ],
  edges: [
    { id: "e_start_init", source: "start", target: "init", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_init_understand", source: "init", target: "understand", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_understand_trace", source: "understand", target: "trace_analysis", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_trace_analysis_alt", source: "trace_analysis", target: "generate_alternatives", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_alt_trace", source: "generate_alternatives", target: "trace_alternatives", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_trace_alt_eval", source: "trace_alternatives", target: "evaluate", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_eval_trace", source: "evaluate", target: "trace_evaluation", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_trace_eval_decide", source: "trace_evaluation", target: "decide", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_decide_trace", source: "decide", target: "trace_decision", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_trace_decision_validate", source: "trace_decision", target: "validate", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_validate_trace", source: "validate", target: "trace_validation", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_trace_validation_branch", source: "trace_validation", target: "accepted", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_accepted_finalize", source: "accepted", target: "finalize", kind: "route", label: "true", sourcePin: "true", targetPin: "in" },
    { id: "e_rejected_reflect", source: "accepted", target: "reflect", kind: "route", label: "false", sourcePin: "false", targetPin: "in" },
    { id: "e_reflect_trace", source: "reflect", target: "trace_reflection", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_trace_reflection_understand", source: "trace_reflection", target: "understand", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e_finalize_end", source: "finalize", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
    data("d_start_task_understand", "start", "task", "understand", "task"),
    data("d_start_context_understand", "start", "context", "understand", "context"),
    data("d_start_constraints_understand", "start", "constraints", "understand", "constraints"),
    data("d_start_expected_understand", "start", "expectedOutput", "understand", "expectedOutput"),
    data("d_start_capabilities_understand", "start", "capabilities", "understand", "capabilities"),
    data("d_start_max_iterations_understand", "start", "maxIterations", "understand", "maxIterations"),
    data("d_init_trace_understand", "init", "trace", "understand", "trace"),
    data("d_decide_understand_decision", "decide", "decision", "understand", "decision"),
    data("d_validate_understand_validation", "validate", "validation", "understand", "validation"),
    data("d_reflect_understand_reflection", "reflect", "reflection", "understand", "reflection"),
    data("d_reflect_trace_understand", "trace_reflection", "trace", "understand", "trace"),
    data("d_understand_trace_value", "understand", "analysisTrace", "trace_analysis", "analysisTrace"),
    data("d_init_trace_analysis", "init", "trace", "trace_analysis", "trace"),
    data("d_start_task_alt", "start", "task", "generate_alternatives", "task"),
    data("d_start_context_alt", "start", "context", "generate_alternatives", "context"),
    data("d_start_constraints_alt", "start", "constraints", "generate_alternatives", "constraints"),
    data("d_start_expected_alt", "start", "expectedOutput", "generate_alternatives", "expectedOutput"),
    data("d_understand_analysis_alt", "understand", "analysis", "generate_alternatives", "analysis"),
    data("d_reflect_alt", "reflect", "reflection", "generate_alternatives", "reflection"),
    data("d_alt_trace_value", "generate_alternatives", "alternativesTrace", "trace_alternatives", "alternativesTrace"),
    data("d_trace_analysis_alt", "trace_analysis", "trace", "trace_alternatives", "trace"),
    data("d_start_task_eval", "start", "task", "evaluate", "task"),
    data("d_start_context_eval", "start", "context", "evaluate", "context"),
    data("d_start_constraints_eval", "start", "constraints", "evaluate", "constraints"),
    data("d_start_expected_eval", "start", "expectedOutput", "evaluate", "expectedOutput"),
    data("d_understand_analysis_eval", "understand", "analysis", "evaluate", "analysis"),
    data("d_alt_eval", "generate_alternatives", "alternatives", "evaluate", "alternatives"),
    data("d_eval_trace_value", "evaluate", "evaluationTrace", "trace_evaluation", "evaluationTrace"),
    data("d_trace_alt_eval", "trace_alternatives", "trace", "trace_evaluation", "trace"),
    data("d_start_task_decide", "start", "task", "decide", "task"),
    data("d_start_context_decide", "start", "context", "decide", "context"),
    data("d_start_constraints_decide", "start", "constraints", "decide", "constraints"),
    data("d_start_expected_decide", "start", "expectedOutput", "decide", "expectedOutput"),
    data("d_understand_analysis_decide", "understand", "analysis", "decide", "analysis"),
    data("d_alt_decide", "generate_alternatives", "alternatives", "decide", "alternatives"),
    data("d_eval_decide", "evaluate", "evaluation", "decide", "evaluation"),
    data("d_decide_trace_value", "decide", "decisionTrace", "trace_decision", "decisionTrace"),
    data("d_trace_eval_decide", "trace_evaluation", "trace", "trace_decision", "trace"),
    data("d_start_task_validate", "start", "task", "validate", "task"),
    data("d_start_context_validate", "start", "context", "validate", "context"),
    data("d_start_constraints_validate", "start", "constraints", "validate", "constraints"),
    data("d_start_expected_validate", "start", "expectedOutput", "validate", "expectedOutput"),
    data("d_decide_validate", "decide", "decision", "validate", "decision"),
    data("d_validate_trace_value", "validate", "validationTrace", "trace_validation", "validationTrace"),
    data("d_trace_decision_validate", "trace_decision", "trace", "trace_validation", "trace"),
    data("d_validate_branch", "validate", "validation", "accepted", "validation"),
    data("d_start_task_reflect", "start", "task", "reflect", "task"),
    data("d_understand_reflect", "understand", "analysis", "reflect", "analysis"),
    data("d_alt_reflect", "generate_alternatives", "alternatives", "reflect", "alternatives"),
    data("d_eval_reflect", "evaluate", "evaluation", "reflect", "evaluation"),
    data("d_decide_reflect", "decide", "decision", "reflect", "decision"),
    data("d_validate_reflect", "validate", "validation", "reflect", "validation"),
    data("d_trace_validation_reflect", "trace_validation", "trace", "reflect", "trace"),
    data("d_reflect_trace_value", "reflect", "reflectionTrace", "trace_reflection", "reflectionTrace"),
    data("d_trace_validation_reflection", "trace_validation", "trace", "trace_reflection", "trace"),
    data("d_decide_finalize", "decide", "decision", "finalize", "decision"),
    data("d_validate_finalize", "validate", "validation", "finalize", "validation"),
    data("d_trace_validation_finalize", "trace_validation", "trace", "finalize", "trace"),
    data("d_finalize_result_end", "finalize", "result", "end", "result"),
    data("d_decide_end", "decide", "decision", "end", "decision"),
    data("d_validate_end", "validate", "validation", "end", "validation"),
    data("d_trace_validation_end", "trace_validation", "trace", "end", "trace"),
    data("d_finalize_iterations_end", "finalize", "iterations", "end", "iterations")
  ]
};

thinkingGraph.nodes = thinkingGraph.nodes.map((node) =>
  node.id === "understand"
    ? {
        ...node,
        data: {
          ...node.data,
          executionPolicy: { maxVisits: 3, maxVisitsFrom: "maxIterations", onExhausted: "fail_run" }
        }
      }
    : node
);

export const thinkingPreset: WorkflowPreset = {
  presetKey: "thinking",
  presetVersion: 1,
  title: "Thinking",
  summary: "Generic bounded thinking loop for difficult workflow decisions.",
  body: [
    "Inputs: task, optional context, constraints, expectedOutput, capabilities, and maxIterations.",
    "The loop analyzes, generates alternatives, evaluates, decides, validates, and reflects when validation rejects the result.",
    "Cycles are controlled by executionPolicy.maxVisitsFrom=maxIterations on the understand node, with maxVisits=3 as fallback.",
    "Output: result, decision, validation, trace, and iterations. Trace entries are compact semantic audit summaries, not private chain-of-thought."
  ].join("\n"),
  status: "accepted",
  kind: "builder",
  graph: thinkingGraph
};

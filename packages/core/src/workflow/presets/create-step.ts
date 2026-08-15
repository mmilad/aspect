import { WORKFLOW_NODE_PLAN_V1_KEY, WORKFLOW_NODE_QA_V1_KEY } from "../llm-json-schemas";
import { WORKFLOW_SCHEMA_VERSION, type WorkflowEdge, type WorkflowGraph, type WorkflowNode } from "../types";
import type { WorkflowPreset } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };
const JSON_SHAPE = { kind: "any" as const };

function data(
  id: string,
  source: string,
  sourcePin: string,
  target: string,
  targetPin: string
): WorkflowEdge {
  return { id, source, target, kind: "data", sourcePin, targetPin };
}

function knot(id: string, x: number, y: number): WorkflowNode {
  return { id, type: "reroute", position: { x, y }, data: { title: "Reroute" } };
}

/**
 * Pin-and-variable proof graph: Start inputs → interpret → create → branch → verify → end,
 * with Fix looping nodePlan pin-to-pin.
 */
export const createStepGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "stepInstructions", role: "input", shape: STRING, required: true },
    { name: "availableBagShape", role: "input", shape: JSON_SHAPE, required: false },
    { name: "allowedNodeTypes", role: "input", shape: JSON_SHAPE, required: false },
    { name: "stepDraft", role: "output", shape: JSON_SHAPE, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 220 },
      data: {
        title: "Start",
        outputContracts: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        }
      }
    },
    knot("r_step_instructions", 210, 300),
    knot("r_available_bag_shape", 210, 340),
    knot("r_allowed_node_types", 210, 380),
    {
      id: "interpret_node_plan",
      type: "llm",
      position: { x: 340, y: 220 },
      data: {
        title: "Interpret node plan",
        inputs: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        },
        outputContracts: {
          nodePlan: { required: true, shape: JSON_SHAPE }
        },
        llm: {
          schemaKey: WORKFLOW_NODE_PLAN_V1_KEY,
          outputSchema: ["nodePlan"],
          instructions: [
            "Create one Projectplaner workflow node plan from the provided step instructions.",
            "Return a single JSON object matching workflow_node_plan_v1.",
            "Only plan one node. Do not create edges or graph fragments.",
            "Use the requested intent and the available bag shape to choose nodeType and config.",
            "Respect allowedNodeTypes when provided.",
            "For foreach, config should contain itemsFrom, itemKey, and indexKey.",
            "For push, config should contain target and valueFrom.",
            "Step instructions: {{stepInstructions}}",
            "Available bag shape: {{availableBagShape}}",
            "Allowed node types: {{allowedNodeTypes}}"
          ].join("\n")
        }
      }
    },
    {
      id: "create_node",
      type: "create_workflow_node",
      position: { x: 680, y: 220 },
      data: {
        title: "Create workflow node",
        inputs: {
          nodePlan: { required: true, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE },
          availableBagShape: { required: false, shape: JSON_SHAPE }
        },
        outputContracts: {
          nodePlan: { required: false, shape: JSON_SHAPE },
          workflowNode: { required: false, shape: JSON_SHAPE },
          nodeMeta: { required: true, shape: JSON_SHAPE },
          validationErrors: { required: true, shape: JSON_SHAPE },
          nodePlanValid: { required: true, shape: BOOLEAN },
          hasValidationErrors: { required: true, shape: BOOLEAN },
          repairInstructions: { required: true, shape: STRING },
          stepDraft: { required: true, shape: JSON_SHAPE }
        },
        createWorkflowNode: {
          planFrom: "nodePlan",
          allowedNodeTypesFrom: "allowedNodeTypes",
          availableBagShapeFrom: "availableBagShape",
          outputKey: "workflowNode",
          metaKey: "nodeMeta",
          errorsKey: "validationErrors",
          validKey: "nodePlanValid",
          hasErrorsKey: "hasValidationErrors",
          repairInstructionsKey: "repairInstructions",
          stepDraftKey: "stepDraft"
        }
      }
    },
    {
      id: "factory_valid_branch",
      type: "branch",
      position: { x: 1060, y: 220 },
      data: {
        title: "Factory valid?",
        inputs: {
          condition: { required: true, shape: BOOLEAN }
        }
      }
    },
    {
      id: "verify_node",
      type: "llm",
      position: { x: 1390, y: 220 },
      data: {
        title: "Verify node",
        inputs: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE },
          nodePlan: { required: true, shape: JSON_SHAPE },
          workflowNode: { required: false, shape: JSON_SHAPE },
          nodeMeta: { required: true, shape: JSON_SHAPE },
          validationErrors: { required: true, shape: JSON_SHAPE },
          nodePlanValid: { required: true, shape: BOOLEAN },
          repairInstructions: { required: true, shape: STRING }
        },
        outputContracts: {
          nodeAccepted: { required: true, shape: BOOLEAN },
          qaReason: { required: true, shape: STRING },
          repairInstructions: { required: true, shape: STRING },
          improvements: { required: true, shape: STRING_ARRAY }
        },
        llm: {
          schemaKey: WORKFLOW_NODE_QA_V1_KEY,
          outputSchema: ["nodeAccepted", "qaReason", "repairInstructions", "improvements"],
          instructions: [
            "Verify whether the materialized workflow node satisfies the original step instructions.",
            "Return workflow_node_qa_v1 fields: nodeAccepted, qaReason, repairInstructions, improvements.",
            "Accept only when the node type, config, reads, writes, and visible metadata match the requested intent.",
            "If nodePlanValid is false, nodeAccepted must be false and repairInstructions must explain how to fix the node plan.",
            "Do not create or edit workflow nodes. Only judge the provided node and describe repairs if needed.",
            "Step instructions: {{stepInstructions}}",
            "Available bag shape: {{availableBagShape}}",
            "Allowed node types: {{allowedNodeTypes}}",
            "Node plan: {{nodePlan}}",
            "Workflow node: {{workflowNode}}",
            "Node meta: {{nodeMeta}}",
            "Validation errors: {{validationErrors}}",
            "Factory repair instructions: {{repairInstructions}}"
          ].join("\n")
        }
      }
    },
    {
      id: "qa_branch",
      type: "branch",
      position: { x: 1720, y: 220 },
      data: {
        title: "QA accepted?",
        inputs: {
          condition: { required: true, shape: BOOLEAN }
        }
      }
    },
    {
      id: "fix_node_plan",
      type: "llm",
      position: { x: 1060, y: 500 },
      data: {
        title: "Fix node plan",
        inputs: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE },
          nodePlan: { required: true, shape: JSON_SHAPE },
          workflowNode: { required: false, shape: JSON_SHAPE },
          nodeMeta: { required: false, shape: JSON_SHAPE },
          validationErrors: { required: true, shape: JSON_SHAPE },
          qaReason: { required: false, shape: STRING },
          repairInstructions: { required: true, shape: STRING },
          improvements: { required: false, shape: STRING_ARRAY }
        },
        outputContracts: {
          nodePlan: { required: true, shape: JSON_SHAPE }
        },
        llm: {
          schemaKey: WORKFLOW_NODE_PLAN_V1_KEY,
          outputSchema: ["nodePlan"],
          instructions: [
            "Repair the previous workflow node plan. Return exactly one workflow_node_plan_v1 JSON object.",
            "Keep the original user intent. Do not create edges or graph fragments.",
            "Use the QA reason, repair instructions, validation errors, and improvements to change only the node plan.",
            "Respect allowedNodeTypes when provided.",
            "Step instructions: {{stepInstructions}}",
            "Available bag shape: {{availableBagShape}}",
            "Allowed node types: {{allowedNodeTypes}}",
            "Previous node plan: {{nodePlan}}",
            "Previous workflow node: {{workflowNode}}",
            "Previous node meta: {{nodeMeta}}",
            "Validation errors: {{validationErrors}}",
            "QA reason: {{qaReason}}",
            "Repair instructions: {{repairInstructions}}",
            "Improvements: {{improvements}}"
          ].join("\n")
        }
      }
    },
    {
      id: "end",
      type: "end",
      position: { x: 2030, y: 220 },
      data: {
        title: "End",
        inputs: {
          stepDraft: { required: true, shape: JSON_SHAPE }
        }
      }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "interpret_node_plan", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e2", source: "interpret_node_plan", target: "create_node", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e3", source: "create_node", target: "factory_valid_branch", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e4", source: "factory_valid_branch", target: "verify_node", kind: "route", label: "true", sourcePin: "true", targetPin: "in" },
    { id: "e5", source: "factory_valid_branch", target: "fix_node_plan", kind: "route", label: "false", sourcePin: "false", targetPin: "in" },
    { id: "e6", source: "verify_node", target: "qa_branch", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e7", source: "qa_branch", target: "end", kind: "route", label: "true", sourcePin: "true", targetPin: "in" },
    { id: "e8", source: "qa_branch", target: "fix_node_plan", kind: "route", label: "false", sourcePin: "false", targetPin: "in" },
    { id: "e9", source: "fix_node_plan", target: "create_node", kind: "next", sourcePin: "then", targetPin: "in" },
    data("d_start_r_instr", "start", "stepInstructions", "r_step_instructions", "value"),
    data("d_r_instr_interp", "r_step_instructions", "value", "interpret_node_plan", "stepInstructions"),
    data("d_r_instr_verify", "r_step_instructions", "value", "verify_node", "stepInstructions"),
    data("d_r_instr_fix", "r_step_instructions", "value", "fix_node_plan", "stepInstructions"),
    data("d_start_r_shape", "start", "availableBagShape", "r_available_bag_shape", "value"),
    data("d_r_shape_interp", "r_available_bag_shape", "value", "interpret_node_plan", "availableBagShape"),
    data("d_r_shape_create", "r_available_bag_shape", "value", "create_node", "availableBagShape"),
    data("d_r_shape_verify", "r_available_bag_shape", "value", "verify_node", "availableBagShape"),
    data("d_r_shape_fix", "r_available_bag_shape", "value", "fix_node_plan", "availableBagShape"),
    data("d_start_r_types", "start", "allowedNodeTypes", "r_allowed_node_types", "value"),
    data("d_r_types_interp", "r_allowed_node_types", "value", "interpret_node_plan", "allowedNodeTypes"),
    data("d_r_types_create", "r_allowed_node_types", "value", "create_node", "allowedNodeTypes"),
    data("d_r_types_verify", "r_allowed_node_types", "value", "verify_node", "allowedNodeTypes"),
    data("d_r_types_fix", "r_allowed_node_types", "value", "fix_node_plan", "allowedNodeTypes"),
    data("d_interp_create_plan", "interpret_node_plan", "nodePlan", "create_node", "nodePlan"),
    data("d_fix_create_plan", "fix_node_plan", "nodePlan", "create_node", "nodePlan"),
    data("d_create_branch_valid", "create_node", "nodePlanValid", "factory_valid_branch", "condition"),
    data("d_create_verify_plan", "create_node", "nodePlan", "verify_node", "nodePlan"),
    data("d_create_verify_node", "create_node", "workflowNode", "verify_node", "workflowNode"),
    data("d_create_verify_meta", "create_node", "nodeMeta", "verify_node", "nodeMeta"),
    data("d_create_verify_errors", "create_node", "validationErrors", "verify_node", "validationErrors"),
    data("d_create_verify_valid", "create_node", "nodePlanValid", "verify_node", "nodePlanValid"),
    data("d_create_verify_repair", "create_node", "repairInstructions", "verify_node", "repairInstructions"),
    data("d_verify_qa_accepted", "verify_node", "nodeAccepted", "qa_branch", "condition"),
    data("d_create_fix_plan", "create_node", "nodePlan", "fix_node_plan", "nodePlan"),
    data("d_create_fix_node", "create_node", "workflowNode", "fix_node_plan", "workflowNode"),
    data("d_create_fix_meta", "create_node", "nodeMeta", "fix_node_plan", "nodeMeta"),
    data("d_create_fix_errors", "create_node", "validationErrors", "fix_node_plan", "validationErrors"),
    data("d_create_fix_repair", "create_node", "repairInstructions", "fix_node_plan", "repairInstructions"),
    data("d_verify_fix_reason", "verify_node", "qaReason", "fix_node_plan", "qaReason"),
    data("d_verify_fix_repair", "verify_node", "repairInstructions", "fix_node_plan", "repairInstructions"),
    data("d_verify_fix_improvements", "verify_node", "improvements", "fix_node_plan", "improvements"),
    data("d_create_end_draft", "create_node", "stepDraft", "end", "stepDraft")
  ]
};

export const createStepPreset: WorkflowPreset = {
  presetKey: "create_step",
  presetVersion: 5,
  title: "Create step",
  summary:
    "Pin-variable step builder: interpret instructions, create one workflow node, QA it, and return stepDraft.",
  body: [
    "Inputs: stepInstructions:string plus optional availableBagShape and allowedNodeTypes.",
    "Start data pins fan through reroute knots to interpret, create, verify, and fix.",
    "Output: stepDraft.",
    "Interpret LLM output pin: nodePlan (workflow_node_plan_v1).",
    "Factory output pins: workflowNode, nodeMeta, nodePlanValid, validationErrors, hasValidationErrors, repairInstructions, stepDraft, nodePlan (echo).",
    "Verifier LLM output pins: nodeAccepted, qaReason, repairInstructions, improvements.",
    "Rejected output routes into a dedicated fix-node-plan LLM, then re-runs deterministic creation and verification."
  ].join("\n"),
  status: "accepted",
  graph: createStepGraph
};

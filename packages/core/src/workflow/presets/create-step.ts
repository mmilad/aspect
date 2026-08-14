import { WORKFLOW_NODE_PLAN_V1_KEY, WORKFLOW_NODE_QA_V1_KEY } from "../llm-json-schemas";
import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import { identityBindings } from "./bindings";
import type { WorkflowPreset } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
const STRING_ARRAY = { kind: "array" as const, items: STRING };
const JSON_SHAPE = { kind: "any" as const };

/**
 * Generic step-builder preset for the "create workflow" workstream.
 * It interprets instructions into one node plan, materializes one workflow
 * node deterministically, verifies it, and uses a dedicated repair step when QA fails.
 */
export const createStepGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 220 },
      data: {
        title: "Start",
        writes: [
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes"
        ],
        writeBindings: identityBindings([
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes"
        ]),
        outputContracts: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        }
      }
    },
    {
      id: "interpret_node_plan",
      type: "llm",
      position: { x: 340, y: 220 },
      data: {
        title: "Interpret node plan",
        reads: [
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes"
        ],
        inputs: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE }
        },
        inputBindings: identityBindings([
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes"
        ]),
        writes: ["nodePlan"],
        writeBindings: identityBindings(["nodePlan"]),
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
        reads: ["nodePlan"],
        inputs: {
          nodePlan: { required: true, shape: JSON_SHAPE }
        },
        inputBindings: identityBindings(["nodePlan"]),
        writes: [
          "workflowNode",
          "nodeMeta",
          "validationErrors",
          "hasValidationErrors",
          "repairInstructions",
          "stepDraft"
        ],
        writeBindings: identityBindings([
          "workflowNode",
          "nodeMeta",
          "validationErrors",
          "hasValidationErrors",
          "repairInstructions",
          "stepDraft"
        ]),
        outputContracts: {
          workflowNode: { required: false, shape: JSON_SHAPE },
          nodeMeta: { required: true, shape: JSON_SHAPE },
          validationErrors: { required: true, shape: JSON_SHAPE },
          hasValidationErrors: { required: true, shape: BOOLEAN },
          repairInstructions: { required: true, shape: STRING },
          stepDraft: { required: true, shape: JSON_SHAPE }
        },
        createWorkflowNode: {
          planFrom: "nodePlan",
          outputKey: "workflowNode",
          metaKey: "nodeMeta",
          errorsKey: "validationErrors",
          hasErrorsKey: "hasValidationErrors",
          repairInstructionsKey: "repairInstructions",
          stepDraftKey: "stepDraft"
        }
      }
    },
    {
      id: "verify_node",
      type: "llm",
      position: { x: 1060, y: 220 },
      data: {
        title: "Verify node",
        reads: [
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes",
          "nodePlan",
          "workflowNode",
          "nodeMeta",
          "validationErrors",
          "hasValidationErrors",
          "repairInstructions"
        ],
        inputs: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE },
          nodePlan: { required: true, shape: JSON_SHAPE },
          workflowNode: { required: false, shape: JSON_SHAPE },
          nodeMeta: { required: true, shape: JSON_SHAPE },
          validationErrors: { required: true, shape: JSON_SHAPE },
          hasValidationErrors: { required: true, shape: BOOLEAN },
          repairInstructions: { required: true, shape: STRING }
        },
        inputBindings: identityBindings([
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes",
          "nodePlan",
          "workflowNode",
          "nodeMeta",
          "validationErrors",
          "hasValidationErrors",
          "repairInstructions"
        ]),
        writes: ["nodeAccepted", "qaReason", "repairInstructions", "improvements"],
        writeBindings: identityBindings([
          "nodeAccepted",
          "qaReason",
          "repairInstructions",
          "improvements"
        ]),
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
            "If hasValidationErrors is true, nodeAccepted must be false and repairInstructions must explain how to fix the node plan.",
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
      position: { x: 1390, y: 220 },
      data: {
        title: "QA accepted?",
        reads: ["nodeAccepted"],
        inputs: {
          nodeAccepted: { required: true, shape: BOOLEAN }
        },
        inputBindings: identityBindings(["nodeAccepted"]),
        branch: { on: "nodeAccepted" }
      }
    },
    {
      id: "fix_node_plan",
      type: "llm",
      position: { x: 1060, y: 480 },
      data: {
        title: "Fix node plan",
        reads: [
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes",
          "nodePlan",
          "workflowNode",
          "nodeMeta",
          "validationErrors",
          "qaReason",
          "repairInstructions",
          "improvements"
        ],
        inputs: {
          stepInstructions: { required: true, shape: STRING },
          availableBagShape: { required: false, shape: JSON_SHAPE },
          allowedNodeTypes: { required: false, shape: JSON_SHAPE },
          nodePlan: { required: true, shape: JSON_SHAPE },
          workflowNode: { required: false, shape: JSON_SHAPE },
          nodeMeta: { required: true, shape: JSON_SHAPE },
          validationErrors: { required: true, shape: JSON_SHAPE },
          qaReason: { required: true, shape: STRING },
          repairInstructions: { required: true, shape: STRING },
          improvements: { required: true, shape: STRING_ARRAY }
        },
        inputBindings: identityBindings([
          "stepInstructions",
          "availableBagShape",
          "allowedNodeTypes",
          "nodePlan",
          "workflowNode",
          "nodeMeta",
          "validationErrors",
          "qaReason",
          "repairInstructions",
          "improvements"
        ]),
        writes: ["nodePlan"],
        writeBindings: identityBindings(["nodePlan"]),
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
      position: { x: 1700, y: 220 },
      data: { title: "End" }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "interpret_node_plan", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e2", source: "interpret_node_plan", target: "create_node", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e3", source: "create_node", target: "verify_node", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e4", source: "verify_node", target: "qa_branch", kind: "next", sourcePin: "then", targetPin: "in" },
    { id: "e5", source: "qa_branch", target: "end", kind: "route", label: "true", sourcePin: "true", targetPin: "in" },
    { id: "e6", source: "qa_branch", target: "fix_node_plan", kind: "route", label: "false", sourcePin: "false", targetPin: "in" },
    { id: "e7", source: "fix_node_plan", target: "create_node", kind: "next", sourcePin: "then", targetPin: "in" }
  ]
};

export const createStepPreset: WorkflowPreset = {
  presetKey: "create_step",
  presetVersion: 3,
  title: "Create step",
  summary:
    "Generic workflow step builder: interpret instructions, create one workflow node, QA it, and return stepDraft JSON.",
  body: [
    "Inputs: stepInstructions:string plus optional availableBagShape and allowedNodeTypes.",
    "Interpret LLM output: nodePlan JSON matching workflow_node_plan_v1.",
    "Factory output: workflowNode, nodeMeta, validationErrors, hasValidationErrors, repairInstructions, stepDraft.",
    "Verifier LLM output: nodeAccepted:boolean, qaReason, repairInstructions, improvements.",
    "Rejected output routes into a dedicated fix-node-plan LLM, then re-runs deterministic creation and verification."
  ].join("\n"),
  status: "accepted",
  graph: createStepGraph
};

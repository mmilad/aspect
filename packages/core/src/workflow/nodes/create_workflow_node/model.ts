import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeCreateWorkflowNode } from "./execute";
import { createWorkflowNodeInspectorFields } from "./inspector";
import { parseCreateWorkflowNodeNodeConfig } from "./schema";

const JSON_SHAPE: BagShape = { kind: "any" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const STRING: BagShape = { kind: "primitive", type: "string" };

export const createWorkflowNodeNode: WorkflowNodeModel = {
  type: "create_workflow_node",
  kind: "work",
  description: "Creates one normalized workflow node from a machine-authored node plan.",
  configKey: "createWorkflowNode",
  defaultData: () => ({
    title: "Create workflow node",
    reads: ["nodePlan"],
    writes: [
      "workflowNode",
      "nodeMeta",
      "validationErrors",
      "hasValidationErrors",
      "repairInstructions"
    ],
    createWorkflowNode: {
      planFrom: "nodePlan",
      outputKey: "workflowNode",
      metaKey: "nodeMeta",
      errorsKey: "validationErrors",
      hasErrorsKey: "hasValidationErrors",
      repairInstructionsKey: "repairInstructions"
    },
    outputContracts: {
      workflowNode: { required: false, shape: JSON_SHAPE },
      nodeMeta: { required: true, shape: JSON_SHAPE },
      validationErrors: { required: true, shape: JSON_SHAPE },
      hasValidationErrors: { required: true, shape: BOOLEAN },
      repairInstructions: { required: true, shape: STRING }
    }
  }),
  parseConfig: parseCreateWorkflowNodeNodeConfig,
  execute: executeCreateWorkflowNode,
  inspectorFields: createWorkflowNodeInspectorFields,
  dataInputs: (node) => [node.data.createWorkflowNode?.planFrom ?? "nodePlan"],
  dataOutputs: (node) => [
    node.data.createWorkflowNode?.outputKey ?? "workflowNode",
    node.data.createWorkflowNode?.metaKey ?? "nodeMeta",
    node.data.createWorkflowNode?.errorsKey ?? "validationErrors",
    node.data.createWorkflowNode?.hasErrorsKey ?? "hasValidationErrors",
    node.data.createWorkflowNode?.repairInstructionsKey ?? "repairInstructions",
    node.data.createWorkflowNode?.stepDraftKey
  ].filter(Boolean) as string[],
  canvasFields: (node) => [
    { label: "plan", value: node.data.createWorkflowNode?.planFrom ?? "nodePlan" },
    { label: "out", value: node.data.createWorkflowNode?.outputKey ?? "workflowNode" }
  ]
};

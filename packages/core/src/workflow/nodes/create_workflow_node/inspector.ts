import type { WorkflowInspectorField } from "../_shared/inspector";

export const createWorkflowNodeInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagKey", label: "Node plan from", path: "createWorkflowNode.planFrom" },
  { kind: "text", label: "Output key", path: "createWorkflowNode.outputKey" },
  { kind: "text", label: "Meta key", path: "createWorkflowNode.metaKey" },
  { kind: "text", label: "Errors key", path: "createWorkflowNode.errorsKey" },
  { kind: "text", label: "Has errors key", path: "createWorkflowNode.hasErrorsKey" },
  {
    kind: "text",
    label: "Repair instructions key",
    path: "createWorkflowNode.repairInstructionsKey"
  },
  { kind: "text", label: "Step draft key", path: "createWorkflowNode.stepDraftKey" }
];

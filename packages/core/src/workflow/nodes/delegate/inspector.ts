import type { WorkflowInspectorField } from "../_shared/inspector";

export const delegateInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagPorts" },
  { kind: "bagKey", label: "Agent id from", path: "delegate.agentIdFrom" },
  { kind: "bagKey", label: "Task from", path: "delegate.taskFrom" },
  { kind: "bagKey", label: "Run id from", path: "delegate.runIdFrom" },
  { kind: "bagKey", label: "Message from", path: "delegate.messageFrom" },
  { kind: "executionPolicy" }
];

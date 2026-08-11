import type { WorkflowInspectorField } from "../_shared/inspector";

export const gateInspectorFields: WorkflowInspectorField[] = [
  { kind: "text", label: "Stop if", path: "gate.stopIf" },
  { kind: "text", label: "Ask user if", path: "gate.askUserIf" }
];

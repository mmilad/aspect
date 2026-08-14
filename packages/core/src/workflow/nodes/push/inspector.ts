import type { WorkflowInspectorField } from "../_shared/inspector";

export const pushInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagKey", label: "Target array", path: "push.target" },
  { kind: "text", label: "Value from", path: "push.valueFrom" }
];

import type { WorkflowInspectorField } from "../_shared/inspector";

export const breakInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagPorts" },
  { kind: "bagKey", label: "Break object from", path: "break.from" }
];

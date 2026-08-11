import type { WorkflowInspectorField } from "../_shared/inspector";

export const toolInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagPorts" },
  { kind: "text", label: "Tool name", path: "tool.name" },
  { kind: "toolArgs" },
  { kind: "executionPolicy" }
];

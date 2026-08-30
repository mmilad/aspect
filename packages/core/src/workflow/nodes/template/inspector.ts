import type { WorkflowInspectorField } from "../_shared/inspector";

export const templateInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagPorts" },
  {
    kind: "textarea",
    label: "Template",
    path: "template",
    placeholder: "{{name}}"
  }
];

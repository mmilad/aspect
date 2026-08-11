import type { WorkflowInspectorField } from "../_shared/inspector";

export const writeInspectorFields: WorkflowInspectorField[] = [
  {
    kind: "select",
    label: "Write action",
    path: "write.action",
    options: [
      { value: "create_entity", label: "create_entity" },
      { value: "update_entity", label: "update_entity" },
      { value: "rollup_parent_status", label: "rollup_parent_status" }
    ]
  },
  { kind: "executionPolicy" }
];

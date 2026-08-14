import type { WorkflowInspectorField } from "../_shared/inspector";

export const foreachInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagKey", label: "Items from", path: "foreach.itemsFrom" },
  { kind: "text", label: "Item key", path: "foreach.itemKey" },
  { kind: "text", label: "Index key", path: "foreach.indexKey" },
  {
    kind: "select",
    label: "Failure mode",
    path: "foreach.failureMode",
    options: [
      { value: "fail", label: "fail" },
      { value: "continue", label: "continue" }
    ]
  }
];

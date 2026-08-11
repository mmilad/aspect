import type { WorkflowInspectorField } from "../_shared/inspector";

export const contextInspectorFields: WorkflowInspectorField[] = [
  {
    kind: "select",
    label: "Load mode",
    path: "auto.loadContext.mode",
    options: [
      { value: "query", label: "query" },
      { value: "all", label: "all" }
    ]
  },
  { kind: "bagKey", label: "Query from", path: "auto.loadContext.queryFrom" },
  { kind: "number", label: "Limit", path: "auto.loadContext.limit" }
];

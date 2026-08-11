import type { WorkflowInspectorField } from "../_shared/inspector";

export const joinInspectorFields: WorkflowInspectorField[] = [
  {
    kind: "select",
    label: "Join mode",
    path: "join.mode",
    options: [
      { value: "all", label: "all" },
      { value: "any", label: "any" },
      { value: "count:1", label: "count:1" },
      { value: "count:2", label: "count:2" }
    ]
  },
  {
    kind: "select",
    label: "Remaining arms",
    path: "join.remaining",
    options: [
      { value: "cancel_remaining", label: "cancel_remaining" },
      { value: "ignore_remaining", label: "ignore_remaining" }
    ]
  }
];

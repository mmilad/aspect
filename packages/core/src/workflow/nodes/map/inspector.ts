import type { WorkflowInspectorField } from "../_shared/inspector";

export const mapInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagPorts" },
  { kind: "bagKey", label: "Map from", path: "map.from" },
  { kind: "text", label: "Write as", path: "map.as" },
  {
    kind: "select",
    label: "Mode",
    path: "map.mode",
    options: [
      { value: "array", label: "array" },
      { value: "object", label: "object" }
    ]
  },
  { kind: "mapFields" }
];

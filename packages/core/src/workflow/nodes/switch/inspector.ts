import type { WorkflowInspectorField } from "../_shared/inspector";

export const switchInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagKey", label: "Switch on (bag key)", path: "switch.on" },
  { kind: "text", label: "Default route label", path: "switch.defaultLabel" }
];

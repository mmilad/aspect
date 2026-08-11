import type { WorkflowInspectorField } from "../_shared/inspector";

export const waitInspectorFields: WorkflowInspectorField[] = [
  { kind: "number", label: "Delay ms", path: "wait.delayMs" },
  { kind: "text", label: "Until (ISO)", path: "wait.until" }
];

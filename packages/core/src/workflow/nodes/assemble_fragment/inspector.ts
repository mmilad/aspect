import type { WorkflowInspectorField } from "../_shared/inspector";

export const assembleFragmentInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagKey", label: "Step drafts from", path: "assembleFragment.draftsFrom" },
  { kind: "text", label: "Output key", path: "assembleFragment.outputKey" }
];

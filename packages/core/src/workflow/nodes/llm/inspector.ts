import type { WorkflowInspectorField } from "../_shared/inspector";
import { DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT } from "../../llm-defaults";

export const llmInspectorFields: WorkflowInspectorField[] = [
  { kind: "bagPorts" },
  {
    kind: "textarea",
    label: "System prompt",
    path: "llm.systemPrompt",
    placeholder: DEFAULT_WORKFLOW_LLM_SYSTEM_PROMPT
  },
  {
    kind: "textarea",
    label: "Task instructions",
    path: "llm.instructions"
  },
  {
    kind: "select",
    label: "Response format",
    path: "llm.format",
    options: [
      { value: "", label: "text (default)" },
      { value: "text", label: "text" },
      { value: "json", label: "json" },
      { value: "json_schema", label: "json_schema" }
    ]
  },
  {
    kind: "llmSchemaKey",
    label: "JSON schema"
  },
  { kind: "executionPolicy" }
];

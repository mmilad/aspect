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
  { kind: "executionPolicy" }
];

import type { WorkflowNodeModel } from "../_shared/model";
import { executeLlm } from "./execute";
import { llmInspectorFields } from "./inspector";
import { parseLlmNodeConfig } from "./schema";

export const llmNode: WorkflowNodeModel = {
  type: "llm",
  kind: "work",
  configKey: "llm",
  defaultData: () => ({ title: "LLM", reads: [], writes: [], llm: { instructions: "", tools: [] } }),
  parseConfig: parseLlmNodeConfig,
  execute: executeLlm,
  inspectorFields: llmInspectorFields
};

import type { WorkflowNodeModel } from "../_shared/model";
import { executeTool } from "./execute";
import { toolInspectorFields } from "./inspector";
import { parseToolNodeConfig } from "./schema";

export const toolNode: WorkflowNodeModel = {
  type: "tool",
  kind: "work",
  configKey: "tool",
  defaultData: () => ({ title: "Tool", reads: [], writes: [], tool: { name: "" } }),
  parseConfig: parseToolNodeConfig,
  execute: executeTool,
  inspectorFields: toolInspectorFields
};

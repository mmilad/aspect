import type { WorkflowNodeModel } from "../_shared/model";
import { executeSet } from "./execute";
import { setInspectorFields } from "./inspector";
import { parseSetNodeConfig } from "./schema";

export const setNode: WorkflowNodeModel = {
  type: "set",
  kind: "variable",
  description: "Writes a data pin into a local graph variable.",
  defaultData: () => ({ title: "Set", variable: "", inputs: { value: { required: true } } }),
  parseConfig: parseSetNodeConfig,
  execute: executeSet,
  inspectorFields: setInspectorFields,
  execInputs: () => ["in"],
  execOutputs: () => ["then"],
  dataInputs: () => ["value"],
  canvasFields: (node) =>
    node.data.variable ? [{ label: "var", value: node.data.variable }] : [],
  validateTopology: (ctx) => {
    if (!ctx.node.data.variable?.trim()) {
      ctx.errors.push(`Set ${ctx.node.id} requires data.variable.`);
    }
    const dataIns = ctx.incoming.filter((edge) => edge.kind === "data");
    if (dataIns.length < 1) {
      ctx.errors.push(`Set ${ctx.node.id} requires a data in-edge on value.`);
    }
  }
};

import type { WorkflowNodeModel } from "../_shared/model";
import { executeGet } from "./execute";
import { getInspectorFields } from "./inspector";
import { parseGetNodeConfig } from "./schema";

export const getNode: WorkflowNodeModel = {
  type: "get",
  kind: "variable",
  description: "Reads a graph variable onto a data pin. Pure — no exec pins.",
  defaultData: () => ({ title: "Get", variable: "" }),
  parseConfig: parseGetNodeConfig,
  execute: executeGet,
  inspectorFields: getInspectorFields,
  execInputs: () => [],
  execOutputs: () => [],
  dataOutputs: (node) => (node.data.variable ? [node.data.variable] : ["value"]),
  canvasFields: (node) =>
    node.data.variable ? [{ label: "var", value: node.data.variable }] : [],
  validateTopology: (ctx) => {
    if (!ctx.node.data.variable?.trim()) {
      ctx.errors.push(`Get ${ctx.node.id} requires data.variable.`);
    }
    if (ctx.incoming.some((edge) => edge.kind !== "data")) {
      ctx.errors.push(`Get ${ctx.node.id} cannot have exec in-edges.`);
    }
    if (ctx.outgoing.some((edge) => edge.kind !== "data")) {
      ctx.errors.push(`Get ${ctx.node.id} cannot have exec out-edges.`);
    }
  }
};

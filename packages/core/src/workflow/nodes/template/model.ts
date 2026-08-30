import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeTemplate } from "./execute";
import { templateInspectorFields } from "./inspector";
import { parseTemplateNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };

export const templateNode: WorkflowNodeModel = {
  type: "template",
  kind: "variable",
  description: "Fills a {{pin}} template from data inputs into a string. Pure — no exec pins.",
  defaultData: () => ({
    title: "Template",
    template: "",
    outputContracts: {
      text: { required: true, shape: STRING }
    }
  }),
  parseConfig: parseTemplateNodeConfig,
  execute: executeTemplate,
  inspectorFields: templateInspectorFields,
  inferOutputs: () => ({ text: STRING }),
  execInputs: () => [],
  execOutputs: () => [],
  dataInputs: (node) => Object.keys(node.data.inputs ?? {}),
  dataOutputs: () => ["text"],
  canvasFields: (node) => {
    const body = typeof node.data.template === "string" ? node.data.template.trim() : "";
    if (!body) {
      return [];
    }
    const preview = body.length > 24 ? `${body.slice(0, 24)}…` : body;
    return [{ label: "tpl", value: preview }];
  },
  validateTopology: (ctx) => {
    if (ctx.incoming.some((edge) => edge.kind !== "data")) {
      ctx.errors.push(`Template ${ctx.node.id} cannot have exec in-edges.`);
    }
    if (ctx.outgoing.some((edge) => edge.kind !== "data")) {
      ctx.errors.push(`Template ${ctx.node.id} cannot have exec out-edges.`);
    }
  }
};

import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeForeach } from "./execute";
import { foreachInspectorFields } from "./inspector";
import { parseForeachNodeConfig } from "./schema";

export const foreachNode: WorkflowNodeModel = {
  type: "foreach",
  kind: "control",
  configKey: "foreach",
  defaultData: () => ({
    title: "Foreach",
    reads: [],
    foreach: {
      itemsFrom: "",
      body: { type: "subworkflow", workflowId: "" }
    }
  }),
  parseConfig: parseForeachNodeConfig,
  execute: executeForeach,
  inspectorFields: foreachInspectorFields,
  validateTopology: (ctx) => {
    if (!ctx.node.data.foreach?.itemsFrom || !ctx.node.data.foreach.body) {
      ctx.errors.push(`Foreach ${ctx.node.id} requires foreach.itemsFrom and foreach.body.`);
    }
  },
  inferOutputs: (node) => {
    const collect = node.data.foreach?.collect;
    if (!collect) {
      return {};
    }
    const out: Record<string, BagShape> = {
      [collect.as]: { kind: "array", items: { kind: "unknown" } }
    };
    return out;
  }
};

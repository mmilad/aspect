import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeForeach } from "./execute";
import { foreachInspectorFields } from "./inspector";
import { parseForeachNodeConfig } from "./schema";

export const foreachNode: WorkflowNodeModel = {
  type: "foreach",
  kind: "control",
  description:
    "Runs the body branch once per item, awaits it, then exits through completed.",
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
    if (!ctx.node.data.foreach?.itemsFrom) {
      ctx.errors.push(`Foreach ${ctx.node.id} requires foreach.itemsFrom.`);
    }
    const body = ctx.outgoing.filter((edge) => edge.sourcePin === "body" || edge.label === "body");
    const loop = ctx.outgoing.filter((edge) => edge.sourcePin === "loop" || edge.label === "loop");
    if (!ctx.node.data.foreach?.body && body.length === 0 && loop.length === 0) {
      ctx.errors.push(`Foreach ${ctx.node.id} requires a body exec output or legacy loop output.`);
    }
  },
  execInputs: () => ["in"],
  execOutputs: () => ["body", "loop", "completed"],
  execInputDescriptions: () => ({
    in: "Start the loop at the first item."
  }),
  execOutputDescriptions: () => ({
    body: "Run this branch once for the current item.",
    loop: "Run this branch once for the current item, then return to the foreach.",
    completed: "Continue here after every item has been processed."
  }),
  dataInputs: (node) => [node.data.foreach?.itemsFrom].filter(Boolean) as string[],
  dataOutputs: (node) => [
    node.data.foreach?.itemKey ?? "item",
    node.data.foreach?.indexKey ?? "index"
  ],
  canvasFields: (node) => {
    const each = node.data.foreach;
    return each
      ? [
          { label: "items", value: each.itemsFrom },
          { label: "index", value: each.indexKey ?? "index" }
        ]
      : [];
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

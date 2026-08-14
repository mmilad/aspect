import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeForeach } from "./execute";
import { foreachInspectorFields } from "./inspector";
import { parseForeachNodeConfig } from "./schema";

export const foreachNode: WorkflowNodeModel = {
  type: "foreach",
  kind: "control",
  description:
    "Runs its loop output once for each item. The body must return to continue; completed runs after the final item.",
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
    const loop = ctx.outgoing.filter((edge) => edge.sourcePin === "loop" || edge.label === "loop");
    const completed = ctx.outgoing.filter((edge) => edge.sourcePin === "completed" || edge.label === "completed");
    if (!ctx.node.data.foreach?.body && (loop.length === 0 || completed.length === 0)) {
      ctx.errors.push(`Foreach ${ctx.node.id} requires loop and completed exec outputs or foreach.body.`);
    }
  },
  execInputs: () => ["in", "continue"],
  execOutputs: () => ["loop", "completed"],
  execInputDescriptions: () => ({
    in: "Start the loop at the first item.",
    continue: "Return here when one loop body iteration is finished."
  }),
  execOutputDescriptions: () => ({
    loop: "Run the loop body for the current item.",
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

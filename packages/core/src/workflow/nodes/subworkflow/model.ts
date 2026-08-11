import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeSubworkflow } from "./execute";
import { subworkflowInspectorFields } from "./inspector";
import { parseSubworkflowNodeConfig } from "./schema";

export const subworkflowNode: WorkflowNodeModel = {
  type: "subworkflow",
  kind: "control",
  configKey: "subworkflow",
  defaultData: () => ({
    title: "Subworkflow",
    subworkflow: { workflowId: "" }
  }),
  parseConfig: parseSubworkflowNodeConfig,
  execute: executeSubworkflow,
  inspectorFields: subworkflowInspectorFields,
  validateTopology: (ctx) => {
    if (!ctx.node.data.subworkflow?.workflowId) {
      ctx.errors.push(`Subworkflow ${ctx.node.id} requires subworkflow.workflowId.`);
    }
  },
  inferOutputs: (node) => {
    const out: Record<string, BagShape> = {};
    for (const parentKey of Object.keys(node.data.subworkflow?.outputMap ?? {})) {
      out[parentKey] = { kind: "unknown" };
    }
    return out;
  }
};

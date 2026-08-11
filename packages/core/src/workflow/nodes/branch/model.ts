import type { WorkflowNodeModel } from "../_shared/model";
import { executeBranch } from "./execute";
import { branchInspectorFields } from "./inspector";
import { parseBranchNodeConfig } from "./schema";

export const branchNode: WorkflowNodeModel = {
  type: "branch",
  kind: "control",
  configKey: "branch",
  defaultData: () => ({ title: "Branch", reads: [], branch: {} }),
  parseConfig: parseBranchNodeConfig,
  execute: executeBranch,
  inspectorFields: branchInspectorFields,
  validateTopology: (ctx) => {
    const routes = ctx.outgoing.filter((edge) => edge.kind === "route");
    if (routes.length < 2) {
      ctx.errors.push(`Branch ${ctx.node.id} requires at least two route edges.`);
    }
    const labels = routes.map((edge) => edge.label ?? "");
    if (new Set(labels).size !== labels.length) {
      ctx.errors.push(`Branch ${ctx.node.id} route labels must be unique.`);
    }
  }
};

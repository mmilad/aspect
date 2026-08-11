import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeJoin } from "./execute";
import { joinInspectorFields } from "./inspector";
import { parseJoinNodeConfig } from "./schema";

export const joinNode: WorkflowNodeModel = {
  type: "join",
  kind: "control",
  configKey: "join",
  defaultData: () => ({ title: "Join", join: { mode: "all" } }),
  parseConfig: parseJoinNodeConfig,
  execute: executeJoin,
  inspectorFields: joinInspectorFields,
  validateTopology: (ctx) => {
    const deps = ctx.incoming.filter((edge) => edge.kind === "depends_on");
    if (deps.length < 2) {
      ctx.errors.push(`Join ${ctx.node.id} requires at least two depends_on edges.`);
    }
    if (ctx.incoming.some((edge) => edge.kind !== "depends_on")) {
      ctx.errors.push(`Join ${ctx.node.id} accepts only depends_on in-edges.`);
    }
  },
  inferOutputs: (node) => {
    const as = node.data.join?.merge?.as ?? "branchResults";
    const out: Record<string, BagShape> = { [as]: { kind: "any" } };
    return out;
  }
};

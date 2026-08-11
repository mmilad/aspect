import type { WorkflowNodeModel } from "../_shared/model";
import { executeFork } from "./execute";
import { parseForkConfig } from "./schema";

export const forkNode: WorkflowNodeModel = {
  type: "fork",
  kind: "control",
  defaultData: () => ({ title: "Fork" }),
  parseConfig: parseForkConfig,
  execute: executeFork,
  validateTopology: (ctx) => {
    const nexts = ctx.outgoing.filter((edge) => edge.kind === "next");
    if (nexts.length < 2) {
      ctx.errors.push(`Fork ${ctx.node.id} requires at least two next edges.`);
    }
  }
};

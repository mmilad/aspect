import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeBreak } from "./execute";
import { parseBreakNodeConfig } from "./schema";
import { breakInspectorFields } from "./inspector";

export const breakNode: WorkflowNodeModel = {
  type: "break",
  kind: "work",
  description: "Split a statically typed object into inherited output fields.",
  configKey: "break",
  defaultData: () => ({ title: "Break", reads: [], writes: [], break: { from: "" } }),
  parseConfig: parseBreakNodeConfig,
  execute: executeBreak,
  inspectorFields: breakInspectorFields,
  execInputs: () => [],
  execOutputs: () => [],
  dataInputs: () => ["value"],
  dataOutputs: (node) => Object.values(node.data.break?.fields ?? {}),
  validateTopology: (ctx) => {
    if (!ctx.node.data.break?.from) ctx.errors.push(`Break ${ctx.node.id} requires break.from.`);
    if (ctx.incoming.some((edge) => edge.kind !== "data")) ctx.errors.push(`Break ${ctx.node.id} cannot have exec in-edges.`);
    if (ctx.outgoing.some((edge) => edge.kind !== "data")) ctx.errors.push(`Break ${ctx.node.id} cannot have exec out-edges.`);
  },
  inferOutputs: (node) => {
    const config = node.data.break;
    if (!config) return {};
    return Object.fromEntries(Object.values(config.fields ?? {}).map((key) => [key, { kind: "unknown" } as BagShape]));
  }
};

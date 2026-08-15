import type { WorkflowNodeModel } from "../_shared/model";
import { parseRerouteNodeConfig } from "./schema";

export const rerouteNode: WorkflowNodeModel = {
  type: "reroute",
  kind: "control",
  description: "Visual data knot. Fan the same value out to multiple receivers.",
  defaultData: () => ({ title: "Reroute" }),
  parseConfig: parseRerouteNodeConfig,
  execInputs: () => [],
  execOutputs: () => [],
  dataInputs: () => ["value"],
  dataOutputs: () => ["value"],
  validateTopology: (ctx) => {
    if (ctx.incoming.some((edge) => edge.kind !== "data")) {
      ctx.errors.push(`Reroute ${ctx.node.id} cannot have exec in-edges.`);
    }
    if (ctx.outgoing.some((edge) => edge.kind !== "data")) {
      ctx.errors.push(`Reroute ${ctx.node.id} cannot have exec out-edges.`);
    }
    const dataIns = ctx.incoming.filter((edge) => edge.kind === "data");
    if (dataIns.length > 1) {
      ctx.errors.push(`Reroute ${ctx.node.id} allows at most one data input.`);
    }
  }
};

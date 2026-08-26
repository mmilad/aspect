import { resolveRouteNextNodeId, usesPinFrame } from "../../graph/schema";
import { resolveDataInput } from "../../graph/frame";
import { readBagExpression, readValuePath } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeBranch(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const on = ctx.node.data.branch?.on ?? "route";
  let value: unknown;
  if (usesPinFrame(ctx.graph)) {
    const [portId, ...path] = on.split(".");
    const portValue = resolveDataInput(
      ctx.graph,
      ctx.bag,
      ctx.node,
      portId && portId !== "route" ? portId : "condition"
    );
    value = path.length > 0 ? readValuePath(portValue, path.join(".")) : portValue;
  } else {
    value = readBagExpression(ctx.bag.keys, on);
  }
  const label = value === undefined || value === null ? "default" : String(value);
  const nextId = resolveRouteNextNodeId(ctx.graph, ctx.node.id, label);
  if (!nextId) {
    return ctx.fail(`Branch ${ctx.node.id}: no route for '${label}'.`);
  }
  return {
    kind: "advanced",
    bag: { ...ctx.bag, cursor: nextId, status: "running", error: undefined },
    nodeId: nextId
  };
}

import { resolveRouteNextNodeId, usesPinFrame } from "../../graph/schema";
import { resolveDataInput } from "../../graph/frame";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeBranch(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const value = usesPinFrame(ctx.graph)
    ? resolveDataInput(ctx.graph, ctx.bag, ctx.node, "condition")
    : ctx.read(ctx.node.data.branch?.on ?? "route");
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

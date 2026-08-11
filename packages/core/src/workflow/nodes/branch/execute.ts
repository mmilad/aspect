import { resolveRouteNextNodeId } from "../../graph/schema";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeBranch(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const on = ctx.node.data.branch?.on ?? "route";
  const value = ctx.read(on);
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

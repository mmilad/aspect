import { resolveRouteNextNodeId } from "../../graph/schema";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeSwitch(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const on = ctx.node.data.switch?.on ?? "type";
  const defaultLabel = ctx.node.data.switch?.defaultLabel ?? "default";
  const value = ctx.read(on);
  const label = value === undefined || value === null ? defaultLabel : String(value);
  const nextId = resolveRouteNextNodeId(ctx.graph, ctx.node.id, label, { defaultLabel });
  if (!nextId) {
    return ctx.fail(
      `Switch ${ctx.node.id}: no route for '${label}' and no default '${defaultLabel}'.`
    );
  }
  return {
    kind: "advanced",
    bag: { ...ctx.bag, cursor: nextId, status: "running", error: undefined },
    nodeId: nextId
  };
}

import { usesPinFrame } from "../../graph/schema";
import { readBagExpression } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executePush(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const push = ctx.node.data.push;
  if (!push?.target || !push.valueFrom) {
    return ctx.fail(`Push node ${ctx.node.id} requires push.target and push.valueFrom.`);
  }

  const current = ctx.read(push.target);
  if (current !== undefined && !Array.isArray(current)) {
    return ctx.fail(`Push ${ctx.node.id}: bag.${push.target} must be an array.`);
  }

  const value = usesPinFrame(ctx.graph) ? ctx.read(push.valueFrom) : readBagExpression(ctx.bag.keys, push.valueFrom);
  const applied = ctx.applyWrites({
    [push.target]: [...(Array.isArray(current) ? current : []), value]
  });
  if (!applied.ok) {
    return ctx.fail(applied.error);
  }
  return ctx.advance();
}

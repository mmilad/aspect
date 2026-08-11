import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeJoin(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const merge = ctx.node.data.join?.merge;
  const as = merge?.as ?? "branchResults";
  const keys = merge?.keys ?? [];
  const merged: Record<string, unknown> = {};
  for (const key of keys) {
    merged[key] = ctx.read(key);
  }

  const writes = ctx.getWrites();
  if (writes.includes(as)) {
    const applied = ctx.applyWrites({ [as]: merged });
    if (!applied.ok) {
      return ctx.fail(applied.error);
    }
  } else {
    ctx.bag = {
      ...ctx.bag,
      keys: {
        ...ctx.bag.keys,
        [as]: merged
      }
    };
  }

  return ctx.advance();
}

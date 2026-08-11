import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeStart(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const writes = ctx.getWrites();
  const values: Record<string, unknown> = {};
  if (writes.includes("goal")) {
    values.goal = ctx.bag.goal;
  }
  for (const key of writes) {
    if (key in values) {
      continue;
    }
    // Optional start inputs may be absent; still declare them so contracts stay honest.
    values[key] = key in ctx.bag.keys ? ctx.bag.keys[key] : undefined;
  }
  if (writes.length > 0) {
    const applied = ctx.applyWrites(values);
    if (!applied.ok) {
      return ctx.fail(applied.error);
    }
    return ctx.advance();
  }
  return ctx.advance();
}

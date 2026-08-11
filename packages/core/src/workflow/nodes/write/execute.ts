import { mapArgsFromBag, resolveWriteResult } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeWrite(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const write = ctx.node.data.write;
  if (!write?.action) {
    return ctx.fail(`Write node ${ctx.node.id} requires write.action.`);
  }
  const args = {
    ...(write.defaults ?? {}),
    ...mapArgsFromBag(write.argsFromBag, ctx.bag)
  };
  const result = await resolveWriteResult(ctx.adapters, write.action, args);
  if ("error" in result) {
    return ctx.fail(result.error);
  }
  const applied = ctx.applyWrites(result.values);
  if (!applied.ok) {
    return ctx.fail(applied.error);
  }
  return ctx.advance();
}

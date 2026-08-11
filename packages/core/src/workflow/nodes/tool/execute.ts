import { mapArgsFromBag, resolveToolResult } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeTool(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const tool = ctx.node.data.tool;
  if (!tool?.name) {
    return ctx.fail(`Tool node ${ctx.node.id} requires tool.name.`);
  }
  const args = mapArgsFromBag(tool.argsFromBag, ctx.bag);
  const result = await resolveToolResult(ctx.adapters, tool.name, args);
  if ("error" in result) {
    return ctx.fail(result.error);
  }
  const applied = ctx.applyWrites(result.values);
  if (!applied.ok) {
    return ctx.fail(applied.error);
  }
  return ctx.advance();
}

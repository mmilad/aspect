import { findVariable } from "../../graph/variables";
import { cloneBagWithFrame, ensureFrame, resolveDataInput } from "../../graph/frame";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeSet(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const name = ctx.node.data.variable?.trim();
  if (!name) {
    return ctx.fail(`Set ${ctx.node.id} requires data.variable.`);
  }
  const variable = findVariable(ctx.graph, name);
  if (!variable || variable.role !== "local") {
    return ctx.fail(`Set ${ctx.node.id} target '${name}' is not a local variable.`);
  }
  const value = resolveDataInput(ctx.graph, ctx.bag, ctx.node, "value");
  const frame = ensureFrame(ctx.bag);
  const next = cloneBagWithFrame(ctx.bag, {
    ...frame,
    locals: { ...frame.locals, [name]: value }
  });
  ctx.bag = next;
  return ctx.advance();
}

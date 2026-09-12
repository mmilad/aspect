import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeBreak(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const config = ctx.node.data.break;
  if (!config?.from) return ctx.fail(`Break ${ctx.node.id} requires break.from.`);
  const source = ctx.read(config.from);
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return ctx.fail(`Break ${ctx.node.id}: bag.${config.from} must be a non-null object.`);
  }
  const fields = config.fields ?? Object.fromEntries(Object.keys(source).map((key) => [key, key]));
  const values: Record<string, unknown> = {};
  for (const [from, to] of Object.entries(fields)) values[to] = (source as Record<string, unknown>)[from];
  // Use the runtime write helper so pin-frame graphs receive both bag values
  // and typed output pins. Direct bag writes make downstream data edges and
  // operational traces see the Break outputs as unknown/missing.
  const applied = ctx.applyWrites(values);
  if (!applied.ok) return ctx.fail(applied.error);
  return ctx.advance();
}

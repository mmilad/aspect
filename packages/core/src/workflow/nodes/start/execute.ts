import { usesPinFrame, variablesOfRole } from "../../graph/variables";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeStart(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  if (usesPinFrame(ctx.graph)) {
    const values: Record<string, unknown> = {};
    for (const variable of variablesOfRole(ctx.graph, "input")) {
      const fromFrame = ctx.bag.frame?.inputs[variable.name];
      const fromKeys = ctx.bag.keys[variable.name];
      const value = fromFrame !== undefined ? fromFrame : variable.name === "goal" ? ctx.bag.goal : fromKeys;
      if (value === undefined && variable.required !== false) {
        return ctx.fail(`Missing required input '${variable.name}'.`);
      }
      values[variable.name] = value;
    }
    if (Object.keys(values).length > 0) {
      const applied = ctx.applyWrites(values);
      if (!applied.ok) {
        return ctx.fail(applied.error);
      }
    }
    return ctx.advance();
  }

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

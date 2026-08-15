import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeMath(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const math = ctx.node.data.math;
  if (!math) {
    return ctx.fail(`Math node ${ctx.node.id} requires math config.`);
  }

  const value = ctx.read("value");
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return ctx.fail(`Math ${ctx.node.id}: value must be a finite number.`);
  }
  if (math.operation === "divide" && math.operand === 0) {
    return ctx.fail(`Math ${ctx.node.id}: cannot divide by zero.`);
  }

  const result =
    math.operation === "add"
      ? value + math.operand
      : math.operation === "subtract"
        ? value - math.operand
        : math.operation === "multiply"
          ? value * math.operand
          : value / math.operand;

  const applied = ctx.applyWrites({ result });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

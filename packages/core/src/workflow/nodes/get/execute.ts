import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

/** Get is pure; consumers pull its pin. Not executed on the exec walk. */
export async function executeGet(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  return ctx.fail(`Get ${ctx.node.id} is not an executable step.`);
}

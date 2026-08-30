import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

/** Template is pure; consumers pull its text pin. Not executed on the exec walk. */
export async function executeTemplate(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  return ctx.fail(`Template ${ctx.node.id} is not an executable step.`);
}

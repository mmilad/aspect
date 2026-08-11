import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

/** Error end is handled in WorkflowRun before execute; kept as a no-op for model completeness. */
export async function executeErrorEnd(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  return {
    kind: "completed",
    bag: {
      ...ctx.bag,
      cursor: null,
      status: "failed",
      error: "Workflow ended in error."
    },
    nodeId: ctx.node.id,
    message: "Workflow ended in error."
  };
}

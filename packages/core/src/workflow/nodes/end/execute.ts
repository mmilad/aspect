import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

/** End is handled in WorkflowRun before execute; kept as a no-op for model completeness. */
export async function executeEnd(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  return {
    kind: "completed",
    bag: { ...ctx.bag, cursor: null, status: "completed", error: undefined },
    nodeId: ctx.node.id,
    message: "Workflow completed."
  };
}

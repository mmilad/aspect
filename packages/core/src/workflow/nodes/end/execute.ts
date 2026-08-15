import { copyEndOutputs, usesPinFrame } from "../../graph/schema";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

/** End is handled in WorkflowRun before execute; kept as a no-op for model completeness. */
export async function executeEnd(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const bag = usesPinFrame(ctx.graph) ? copyEndOutputs(ctx.graph, ctx.bag, ctx.node) : ctx.bag;
  return {
    kind: "completed",
    bag: { ...bag, cursor: null, status: "completed", error: undefined },
    nodeId: ctx.node.id,
    message: "Workflow completed."
  };
}

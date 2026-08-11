import { outgoingByKind } from "../../graph/schema";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeFork(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const nexts = outgoingByKind(ctx.graph, ctx.node.id, "next");
  if (nexts.length === 0) {
    return ctx.fail(`Fork ${ctx.node.id} has no next edges.`);
  }
  const targets = nexts.map((edge) => edge.target);
  const first = targets[0]!;
  return {
    kind: "advanced",
    bag: {
      ...ctx.bag,
      frontier: targets,
      cursor: first,
      status: "running",
      error: undefined
    },
    nodeId: first
  };
}

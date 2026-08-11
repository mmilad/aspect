import { evaluateSimpleCondition } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeGate(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const gate = ctx.node.data.gate ?? {};
  if (evaluateSimpleCondition(gate.stopIf, ctx.bag)) {
    return ctx.fail(`Gate ${ctx.node.id} stopIf matched.`);
  }
  if (evaluateSimpleCondition(gate.askUserIf, ctx.bag)) {
    return {
      kind: "pending_user",
      bag: { ...ctx.bag, status: "pending_user", cursor: ctx.node.id },
      nodeId: ctx.node.id,
      message: `Gate ${ctx.node.id} requires user input.`
    };
  }

  let route = "default";
  if (gate.routes) {
    for (const [expression, label] of Object.entries(gate.routes)) {
      if (evaluateSimpleCondition(expression, ctx.bag)) {
        route = label;
        break;
      }
    }
  }
  return ctx.advance(route);
}

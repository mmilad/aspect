import { requireAssistantSession, sliceRecentTurns } from "../../../assistant/window";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeAssistantWindow(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const session = requireAssistantSession(ctx.read("session"));
  if (!session) {
    return ctx.fail(`Assistant window ${ctx.node.id}: session must be an object.`);
  }

  const recentTurns = sliceRecentTurns(session.messages, ctx.read("windowSize"));
  const applied = ctx.applyWrites({ recentTurns });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

import { priorFromSession, requireAssistantSession } from "../../../assistant/window";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeAssistantSession(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const session = requireAssistantSession(ctx.read("session"));
  if (!session) {
    return ctx.fail(`Assistant session ${ctx.node.id}: session must be an object.`);
  }

  const prior = priorFromSession(session);
  const writes: Record<string, unknown> = {
    priorTopics: prior.priorTopics,
    priorQuestions: prior.priorQuestions,
    priorContext: prior.priorContext
  };
  if (prior.priorSummary) {
    writes.priorSummary = prior.priorSummary;
  }

  const applied = ctx.applyWrites(writes);
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

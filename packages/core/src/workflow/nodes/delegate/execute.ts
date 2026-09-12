import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

async function writeResult(ctx: NodeExecuteContext, result: {
  runId: string;
  agentId: string;
  status: string;
  result?: unknown;
  question?: string;
  error?: string;
}, task: string): Promise<WorkflowStepResult> {
  const applied = ctx.applyWrites({
    delegation: result,
    delegationRunId: result.runId,
    delegationAgentId: result.agentId,
    delegationStatus: result.status,
    delegationResult: result.result,
    delegationQuestion: result.question,
    delegationError: result.error,
    pendingDelegation:
      result.status === "waiting"
        ? { runId: result.runId, agentId: result.agentId, task, ...(result.question ? { question: result.question } : {}) }
        : undefined
  });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

export async function executeDelegate(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const config = ctx.node.data.delegate ?? {};
  const rawRunId = ctx.read(config.runIdFrom ?? "runId");
  const runId = rawRunId === null || rawRunId === undefined ? undefined : rawRunId;
  const projectKey = typeof ctx.bag.keys.projectKey === "string" ? ctx.bag.keys.projectKey : "PLAN";

  if (runId !== undefined && typeof runId !== "string") {
    return ctx.fail(`Delegate ${ctx.node.id}: run id must be a string.`);
  }
  if (runId) {
    const resumeId = runId as string;
    const message = ctx.read(config.messageFrom ?? "message");
    if (!ctx.adapters.resumeAgent) return ctx.fail(`Delegate ${ctx.node.id}: no resumeAgent adapter is configured.`);
    if (typeof message !== "string" || !message.trim()) {
      return ctx.fail(`Delegate ${ctx.node.id}: a follow-up message is required to resume an agent.`);
    }
    const followUp = message.trim();
    const pending = ctx.read("pendingDelegation");
    const previousTask = pending && typeof pending === "object" && !Array.isArray(pending) && typeof (pending as { task?: unknown }).task === "string"
      ? (pending as { task: string }).task
      : "pending delegation";
    return writeResult(
      ctx,
      await ctx.adapters.resumeAgent({ runId: resumeId, message: followUp, projectKey }),
      previousTask
    );
  }

  const agentId = ctx.read(config.agentIdFrom ?? "agentId");
  const task = ctx.read(config.taskFrom ?? "task");
  if (typeof agentId !== "string" || !agentId.trim()) return ctx.fail(`Delegate ${ctx.node.id}: agent id is required.`);
  if (typeof task !== "string" || !task.trim()) return ctx.fail(`Delegate ${ctx.node.id}: task is required.`);
  if (!ctx.adapters.runAgent) return ctx.fail(`Delegate ${ctx.node.id}: no runAgent adapter is configured.`);
  return writeResult(ctx, await ctx.adapters.runAgent({ agentId: agentId.trim(), task: task.trim(), projectKey }), task.trim());
}

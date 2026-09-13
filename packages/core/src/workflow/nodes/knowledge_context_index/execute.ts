import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeKnowledgeContextIndex(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.knowledgeContextIndex;
  if (!adapter) return ctx.fail("Knowledge context index is not configured.");
  try {
    const result = await adapter();
    const applied = ctx.applyWrites({
      datasets: result.datasets,
      tools: result.tools,
      relationshipCount: result.relationshipCount,
      usageHint: result.usageHint
    });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge context index failed.");
  }
}

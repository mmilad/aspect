import { assembleFromStepDrafts } from "../../assemble";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeAssembleFragment(
  ctx: NodeExecuteContext
): Promise<WorkflowStepResult> {
  const config = ctx.node.data.assembleFragment;
  const draftsFrom = config?.draftsFrom ?? "stepDrafts";
  const outputKey = config?.outputKey ?? "workflowDraft";
  const drafts = ctx.read(draftsFrom);
  if (!Array.isArray(drafts)) {
    return ctx.fail(
      `Assemble fragment ${ctx.node.id}: '${draftsFrom}' must be an array of step drafts.`
    );
  }

  const assembled = assembleFromStepDrafts(drafts);
  if (!assembled.ok) {
    return ctx.fail(
      `Assemble fragment ${ctx.node.id} failed: ${assembled.errors.join("; ")}`
    );
  }

  const applied = ctx.applyWrites({ [outputKey]: assembled.graph });
  return applied.ok ? ctx.advance() : ctx.fail(applied.error);
}

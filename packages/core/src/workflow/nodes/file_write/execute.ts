import type { WorkflowFileWriteInput } from "../../../files";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeFileWrite(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.fileWrite;
  if (!adapter) return ctx.fail("File writing is not configured or authorized.");
  const config = ctx.node.data.fileWrite ?? {};
  const path = typeof ctx.read(config.pathFrom ?? "path") === "string" ? String(ctx.read(config.pathFrom ?? "path")).trim() : "";
  const contentValue = ctx.read(config.contentFrom ?? "content");
  const content = typeof contentValue === "string" ? contentValue : undefined;
  const rawOverwrite = ctx.read(config.overwriteFrom ?? "overwrite");
  if (!path) return ctx.fail(`File write ${ctx.node.id}: path must be a non-empty relative path.`);
  if (content === undefined) return ctx.fail(`File write ${ctx.node.id}: content must be a string.`);
  if (rawOverwrite !== undefined && rawOverwrite !== null && typeof rawOverwrite !== "boolean") {
    return ctx.fail(`File write ${ctx.node.id}: overwrite must be boolean when provided.`);
  }
  const input: WorkflowFileWriteInput = { path, content, ...(rawOverwrite === undefined || rawOverwrite === null ? {} : { overwrite: rawOverwrite }) };
  try {
    const response = await adapter(input);
    const applied = ctx.applyWrites(response);
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "File write failed.");
  }
}

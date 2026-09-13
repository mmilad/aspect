import type { WorkflowFileReadInput } from "../../../files";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeFileRead(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.fileRead;
  if (!adapter) return ctx.fail("File reading is not configured.");
  const config = ctx.node.data.fileRead ?? {};
  const rawPath = ctx.read(config.pathFrom ?? "path");
  const path = typeof rawPath === "string" ? rawPath.trim() : "";
  if (!path) return ctx.fail(`File read ${ctx.node.id}: path must be a non-empty relative path.`);
  const rawMaxBytes = ctx.read(config.maxBytesFrom ?? "maxBytes");
  const maxBytes = rawMaxBytes === undefined || rawMaxBytes === null ? undefined : Number(rawMaxBytes);
  if (maxBytes !== undefined && (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 10_000_000)) {
    return ctx.fail(`File read ${ctx.node.id}: maxBytes must be an integer between 1 and 10000000.`);
  }
  const input: WorkflowFileReadInput = { path, ...(maxBytes === undefined ? {} : { maxBytes }) };
  try {
    const response = await adapter(input);
    const applied = ctx.applyWrites(response);
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "File read failed.");
  }
}

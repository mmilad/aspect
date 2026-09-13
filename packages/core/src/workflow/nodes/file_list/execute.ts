import type { WorkflowFileListInput } from "../../../files";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

export async function executeFileList(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.fileList;
  if (!adapter) return ctx.fail("File listing is not configured.");
  const config = ctx.node.data.fileList ?? {};
  const rawRecursive = ctx.read(config.recursiveFrom ?? "recursive");
  if (rawRecursive !== undefined && rawRecursive !== null && typeof rawRecursive !== "boolean") {
    return ctx.fail(`File list ${ctx.node.id}: recursive must be boolean when provided.`);
  }
  const rawMaxEntries = ctx.read(config.maxEntriesFrom ?? "maxEntries");
  const maxEntries = optionalInteger(rawMaxEntries);
  if (rawMaxEntries !== undefined && rawMaxEntries !== null && (maxEntries === undefined || maxEntries < 1 || maxEntries > 10000)) {
    return ctx.fail(`File list ${ctx.node.id}: maxEntries must be an integer between 1 and 10000.`);
  }
  const input: WorkflowFileListInput = {
    ...(optionalString(ctx.read(config.pathFrom ?? "path")) ? { path: optionalString(ctx.read(config.pathFrom ?? "path")) } : {}),
    ...(rawRecursive !== undefined && rawRecursive !== null ? { recursive: rawRecursive } : {}),
    ...(maxEntries !== undefined ? { maxEntries } : {})
  };
  try {
    const response = await adapter(input);
    const applied = ctx.applyWrites({ entries: response.entries });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "File listing failed.");
  }
}

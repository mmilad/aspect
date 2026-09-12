import type { KnowledgeAccess, KnowledgeGetInput } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export async function executeKnowledgeGet(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const adapter = ctx.adapters.knowledgeGet;
  if (!adapter) return ctx.fail("Knowledge get is not configured.");
  const config = ctx.node.data.knowledgeGet ?? {};
  const datasetKey = requiredString(config.datasetKey) ?? requiredString(ctx.read(config.datasetKeyFrom ?? "datasetKey"));
  if (!datasetKey) return ctx.fail(`Knowledge get ${ctx.node.id}: datasetKey must be a non-empty string.`);
  const itemId = requiredString(ctx.read(config.itemIdFrom ?? "itemId"));
  if (!itemId) return ctx.fail(`Knowledge get ${ctx.node.id}: itemId must be a non-empty string.`);

  const rawIncludeDeleted = ctx.read(config.includeDeletedFrom ?? "includeDeleted");
  if (rawIncludeDeleted !== undefined && rawIncludeDeleted !== null && typeof rawIncludeDeleted !== "boolean") {
    return ctx.fail(`Knowledge get ${ctx.node.id}: includeDeleted must be boolean when provided.`);
  }
  const rawAccess = ctx.read(config.accessFrom ?? "access");
  const access = rawAccess === undefined || rawAccess === null ? undefined : recordValue(rawAccess) as KnowledgeAccess | undefined;
  if (rawAccess !== undefined && rawAccess !== null && !access) {
    return ctx.fail(`Knowledge get ${ctx.node.id}: access must be an object when provided.`);
  }

  const input: KnowledgeGetInput = {
    datasetKey,
    itemId,
    ...(rawIncludeDeleted !== undefined && rawIncludeDeleted !== null ? { includeDeleted: rawIncludeDeleted } : {}),
    ...(access ? { access } : {})
  };
  try {
    const response = await adapter(input);
    const applied = ctx.applyWrites({ item: response.item, found: response.item !== null });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge get failed.");
  }
}

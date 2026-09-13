import type { KnowledgeScope } from "../../../knowledge";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalInteger(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`${label} must be a boolean.`);
}

function entityText(entity: { type: string; title: string; summary?: string; body?: string }): string {
  const content = [entity.title, entity.summary, entity.body]
    .filter((part): part is string => !!part?.trim());
  return content.length > 0 ? [entity.type, ...content].join("\n\n") : "";
}

export async function executeKnowledgeIndexProject(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const ingest = ctx.adapters.knowledgeIngestText;
  const listEntities = ctx.adapters.listEntities;
  if (!ingest) return ctx.fail("Knowledge project indexing is not configured: text ingest is unavailable.");
  if (!listEntities) return ctx.fail("Knowledge project indexing is not configured: entity listing is unavailable.");

  const config = ctx.node.data.knowledgeIndexProject ?? {};
  const projectKey = requiredString(config.projectKey) ?? requiredString(ctx.read(config.projectKeyFrom ?? "projectKey"));
  const datasetKey = requiredString(config.datasetKey) ?? requiredString(ctx.read(config.datasetKeyFrom ?? "datasetKey"));
  if (!projectKey) return ctx.fail(`Knowledge project indexing ${ctx.node.id}: projectKey must be a non-empty string.`);
  if (!datasetKey) return ctx.fail(`Knowledge project indexing ${ctx.node.id}: datasetKey must be a non-empty string.`);

  try {
    const limit = optionalInteger(ctx.read(config.limitFrom ?? "limit"), "limit", 1, 5000) ?? 500;
    const includeArchived = optionalBoolean(ctx.read(config.includeArchivedFrom ?? "includeArchived"), "includeArchived") ?? false;
    const entities = await listEntities({ projectKey, limit, includeArchived, select: "full" });
    const ids: string[] = [];
    let indexed = 0;
    let skipped = 0;
    let embeddingModel: string | null = null;

    for (const entity of entities) {
      const text = entityText(entity);
      if (!text) {
        skipped += 1;
        continue;
      }
      const scope: KnowledgeScope = { kind: "project", projectKey, sourceId: entity.id };
      const result = await ingest({
        datasetKey,
        text,
        ingestionId: `projectplaner:entity:${entity.id}`,
        metadata: {
          source: "projectplaner",
          sourceType: "entity",
          sourceId: entity.id,
          entityId: entity.id,
          entityType: entity.type,
          entityStatus: entity.status,
          title: entity.title,
          projectKey
        },
        scope
      });
      indexed += result.ingested;
      ids.push(...result.ids);
      if (result.embeddingModel) embeddingModel = result.embeddingModel;
    }

    const applied = ctx.applyWrites({ indexed, ids, skipped, embeddingModel });
    return applied.ok ? ctx.advance() : ctx.fail(applied.error);
  } catch (error) {
    return ctx.fail(error instanceof Error ? error.message : "Knowledge project indexing failed.");
  }
}

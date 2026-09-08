import type { EntityNarrative, EntityType, JsonRecord } from "@projectplaner/core";
import corePlanApi from "@projectplaner/core/plan-api";
import workflow from "@projectplaner/core/workflow";
import {
  getDatabaseController,
  entityStore
} from "@projectplaner/db";


const { resolveMutationPresetKey } = workflow.presets;

export const DEFAULT_PROJECT_KEY = "PLAN";
export const SUMMARY_MAX = 240;
export const BODY_MAX = 2000;
export const DEFAULT_LIST_LIMIT = 30;

export type Db = Awaited<ReturnType<typeof getDatabaseController>>;

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> { return fn(getDatabaseController()); }
export function planApi(db: Db) { return corePlanApi.create(entityStore(db)); }

export function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

export function requireReason(reason: string | undefined, action: string): string {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`${action} requires reason (durable narrative for the next agent).`);
  }
  return trimmed;
}

export async function assertNoSeededMutationPreset(
  db: Db,
  op: "create" | "update" | "delete",
  type: EntityType
): Promise<void> {
  const presetKey = resolveMutationPresetKey({ op, type });
  if (!presetKey) {
    return;
  }
  const seeded = await db.presets.find(presetKey);
  if (!seeded) {
    return;
  }
  throw new Error(
    `Preset "${presetKey}" is seeded (flow ${seeded.id}). Call run_workflow with key="${presetKey}" and a bag instead of ${op === "create" ? "create_entity" : "update_entity"}.`
  );
}

export function mergeNarrativeMetadata(
  existing: JsonRecord,
  narrative: EntityNarrative,
  updatedBy = "agent"
): JsonRecord {
  const current =
    typeof existing.narrative === "object" && existing.narrative && !Array.isArray(existing.narrative)
      ? (existing.narrative as EntityNarrative)
      : {};
  return {
    ...existing,
    narrative: {
      ...current,
      ...narrative,
      updatedAt: new Date().toISOString(),
      updatedBy: narrative.updatedBy ?? updatedBy
    }
  };
}

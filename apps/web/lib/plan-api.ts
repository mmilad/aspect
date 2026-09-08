import { entityStore } from "@projectplaner/db";
import type { EntityFilter, EntityType } from "@projectplaner/core";
import planApi from "@projectplaner/core/plan-api";
import { getDatabaseController } from "@projectplaner/db";

import type { DatabaseController } from "@projectplaner/db";

export function createWebPlanApi(db: DatabaseController) { return planApi.create(entityStore(db)); }
/** Compatibility helper: callbacks do not own a connection or occupy the operation queue. */
export async function withDb<T>(fn: (db: DatabaseController) => Promise<T>): Promise<T> {
 return fn(getDatabaseController());
}

/** Build a PlanApi `where` from common HTTP list params. */
export function entityListWhere(input: {
  type?: string | null;
  query?: string | null;
}): EntityFilter | undefined {
  const parts: EntityFilter[] = [];
  if (input.type) {
    parts.push({ field: "type", op: "eq", value: input.type as EntityType });
  }
  if (input.query?.trim()) {
    parts.push({ field: "q", op: "match", value: input.query.trim() });
  }
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { and: parts };
}

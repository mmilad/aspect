import path from "node:path";
import type { EntityFilter, EntityType } from "@projectplaner/core";
import planApi from "@projectplaner/core/plan-api";
import { openDatabase } from "@projectplaner/db";
import query from "@projectplaner/db/query";
import type { DatabaseSync } from "node:sqlite";

export async function openDb() {
  return openDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

export function createWebPlanApi(db: DatabaseSync) {
  return planApi.create(query.createStore(db));
}

export async function withDb<T>(fn: (db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
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

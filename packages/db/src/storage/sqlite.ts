import type { DatabaseSync } from "node:sqlite";

export type SqlValue = string | number | null;

export function run(db: DatabaseSync, sql: string, values: SqlValue[] = []): void {
  db.prepare(sql).run(...values);
}

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { violations } = require("../scripts/check-db-boundary.cjs") as { violations(file: string, source: string): string[] };

describe("database boundary guard", () => {
  it("rejects driver, SQL, and private adapter access from application and orchestration", () => {
    expect(violations("apps/web/lib/example.ts", 'import type { DatabaseSync } from "node:sqlite";')).toHaveLength(1);
    expect(violations("apps/web/lib/example.ts", 'import repo from "@projectplaner/db/entities";')).toHaveLength(1);
    expect(violations("packages/db/src/rollup.ts", 'import repo from "./adapters/sqlite/repositories/entities";')).toHaveLength(1);
    expect(violations("apps/web/lib/example.ts", 'db.prepare("SELECT 1")')).toHaveLength(1);
  });
  it("allows the public API and the driver-private implementation", () => {
    expect(violations("apps/web/lib/example.ts", 'import { getDatabaseController } from "@projectplaner/db";')).toEqual([]);
    expect(violations("packages/db/src/adapters/sqlite/client.ts", 'import { DatabaseSync } from "node:sqlite";')).toEqual([]);
  });
});

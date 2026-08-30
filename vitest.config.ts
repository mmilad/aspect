import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/agent/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "packages/db/**", "**/*.live.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: [
      { find: "@projectplaner/core/query", replacement: path.join(root, "packages/core/src/domain/query/index.ts") },
      { find: "@projectplaner/core/plan-api", replacement: path.join(root, "packages/core/src/domain/api/index.ts") },
      { find: "@projectplaner/core/domain", replacement: path.join(root, "packages/core/src/domain/index.ts") },
      { find: "@projectplaner/core/legacy", replacement: path.join(root, "packages/core/src/legacy/index.ts") },
      { find: "@projectplaner/core/workflow", replacement: path.join(root, "packages/core/src/workflow/index.ts") },
      { find: "@projectplaner/core/planning", replacement: path.join(root, "packages/core/src/planning/index.ts") },
      { find: "@projectplaner/core/assistant", replacement: path.join(root, "packages/core/src/assistant/index.ts") },
      { find: "@projectplaner/core/generator", replacement: path.join(root, "packages/core/src/generator/index.ts") },
      { find: "@projectplaner/core", replacement: path.join(root, "packages/core/src/index.ts") },
      { find: "@projectplaner/db/entities", replacement: path.join(root, "packages/db/src/repositories/entities.ts") },
      { find: "@projectplaner/db/relations", replacement: path.join(root, "packages/db/src/repositories/relations.ts") },
      { find: "@projectplaner/db/projects", replacement: path.join(root, "packages/db/src/repositories/projects.ts") },
      { find: "@projectplaner/db/snapshots", replacement: path.join(root, "packages/db/src/repositories/snapshots.ts") },
      { find: "@projectplaner/db/tasks", replacement: path.join(root, "packages/db/src/repositories/tasks.ts") },
      { find: "@projectplaner/db/query", replacement: path.join(root, "packages/db/src/query/index.ts") },
      { find: "@projectplaner/db/workflows", replacement: path.join(root, "packages/db/src/workflows/index.ts") },
      { find: "@projectplaner/db/assistant-sessions", replacement: path.join(root, "packages/db/src/repositories/assistant-sessions.ts") },
      { find: "@projectplaner/db/llm-json-schemas", replacement: path.join(root, "packages/db/src/repositories/llm-json-schemas.ts") },
      { find: "@projectplaner/db", replacement: path.join(root, "packages/db/src/index.ts") }
    ]
  }
});


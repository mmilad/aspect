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
    alias: {
      "@projectplaner/core": path.join(root, "packages/core/src/index.ts"),
      "@projectplaner/db": path.join(root, "packages/db/src/index.ts")
    }
  }
});


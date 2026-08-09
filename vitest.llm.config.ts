import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Optional live LLM suite (Ollama / OpenAI-compatible). Not part of default `pnpm test`. */
export default defineConfig({
  test: {
    include: ["packages/**/*.live.test.ts", "tests/**/*.live.test.ts"],
    exclude: ["**/node_modules/**", "packages/db/**"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 30_000
  },
  resolve: {
    alias: {
      "@projectplaner/core": path.join(root, "packages/core/src/index.ts"),
      "@projectplaner/db": path.join(root, "packages/db/src/index.ts")
    }
  }
});

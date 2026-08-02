import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@projectplaner/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@projectplaner/db": new URL("./packages/db/src/index.ts", import.meta.url).pathname
    }
  }
});


import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.PROJECTPLANER_DB_PATH ?? "../../projectplaner.db"
  }
});


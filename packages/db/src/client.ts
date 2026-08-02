import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrate";

const defaultPath = path.resolve(process.cwd(), "projectplaner.db");

export function createDatabase(dbPath = process.env.PROJECTPLANER_DB_PATH ?? defaultPath) {
  const sqlite = new DatabaseSync(dbPath);
  runMigrations(sqlite);
  return sqlite;
}

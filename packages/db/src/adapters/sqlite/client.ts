import { DatabaseSync } from "node:sqlite";
import { defaultDatabasePath } from "../../environment";
import { runMigrations } from "./migrate";
import { migrateWorkspaces } from "./migrate-workspaces";
import { migrateEntityStatuses } from "./migrate-status";

/** Driver-private open. Catalog initialization belongs to the controller. */
export function createDatabase(dbPath = defaultDatabasePath()) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout = 1000; PRAGMA foreign_keys = ON;");
    if (dbPath !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
    const version = () => (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    if (version() > 1) throw new Error("Database schema is newer than this application.");
    if (version() < 1) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (version() < 1) {
          runMigrations(db); migrateWorkspaces(db); migrateEntityStatuses(db);
          db.exec("PRAGMA user_version = 1");
        }
        db.exec("COMMIT");
      } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
    }
    return db;
  } catch (error) { try { db.close(); } catch { } throw error; }
}

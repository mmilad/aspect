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
    if (dbPath !== ":memory:") {
      // Concurrent first opens can hit SQLITE_BUSY during the journal transition,
      // which does not consistently honor SQLite's busy timeout.
      const deadline = Date.now() + 1000;
      for (;;) {
        try { db.exec("PRAGMA journal_mode = WAL;"); break; }
        catch (error) {
          if ((error as { errcode?: number }).errcode !== 5 || Date.now() >= deadline) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
      }
    }
    const version = () => (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    if (version() > 2) throw new Error("Database schema is newer than this application.");
    if (version() < 2) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (version() < 2) {
          runMigrations(db);
          if (version() < 1) { migrateWorkspaces(db); migrateEntityStatuses(db); }
          db.exec("PRAGMA user_version = 2");
        }
        db.exec("COMMIT");
      } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
    }
    return db;
  } catch (error) { try { db.close(); } catch { } throw error; }
}

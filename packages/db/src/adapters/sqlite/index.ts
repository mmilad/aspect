import type { DatabaseSync } from "node:sqlite";
import type { Storage, StorageConnection } from "../../contracts/storage";
import { createDatabase } from "./client";
import entities from "./repositories/entities";
import relations from "./repositories/relations";
import projects from "./repositories/projects";
import workspaces from "./repositories/project-workspaces";
import tasks from "./repositories/tasks";
import tags from "./repositories/tags";
import snapshots from "./repositories/snapshots";
import assistantSessions from "./repositories/assistant-sessions";
import llmJsonSchemas from "./repositories/llm-json-schemas";
import persist from "./workflows/persist";
import agentRuns from "./repositories/agent-runs";
import { execute } from "./query/compile";
import { validateStoredProjectGraph } from "./repositories/graph";

type Bound<T> = { [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]:
  T[K] extends (db: DatabaseSync, ...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never };

function bind<T extends object>(db: DatabaseSync, operations: T): Bound<T> {
  return Object.fromEntries(Object.entries(operations).filter(([, value]) => typeof value === "function")
    .map(([key, value]) => [key, async (...args: unknown[]) => value(db, ...args)])) as Bound<T>;
}

/** Only adapter tests may supply a raw connection. */
export function sqliteStorage(db: DatabaseSync): Storage {
  let savepoint = 0;
  const storage: Storage = {
    entities: bind(db, entities), relations: bind(db, relations),
    projects: {
      ...bind(db, projects),
      async findByKey(key) {
        return db.prepare("SELECT id, key, archived_at AS archivedAt FROM projects WHERE key = ?")
          .get(key.toUpperCase()) as { id: string; key: string; archivedAt: string | null } | undefined ?? null;
      },
      async keyForId(id) {
        return (db.prepare("SELECT key FROM projects WHERE id = ?").get(id) as { key: string } | undefined)?.key;
      }
    },
    workspaces: bind(db, workspaces), tasks: bind(db, tasks), tags: bind(db, tags),
    snapshots: bind(db, snapshots), assistantSessions: bind(db, assistantSessions), agentRuns: bind(db, agentRuns),
    llmJsonSchemas: bind(db, llmJsonSchemas), persist: bind(db, persist),
    query: {
      execute: (plan) => execute(db, plan),
      async validate(projectId) { return validateStoredProjectGraph(db, projectId); }
    },
    catalog: {
      async findPreset(projectKey, presetKey) {
        const row = db.prepare(`SELECT e.id, e.project_id AS projectId, e.metadata_json AS metadata, e.title
          FROM entities e JOIN projects p ON p.id = e.project_id
          WHERE p.key = ? AND e.type = 'flow' AND json_extract(e.metadata_json, '$.presetKey') = ? LIMIT 1`)
          .get(projectKey, presetKey) as { id: string; projectId: string; metadata: string; title: string } | undefined;
        return row ? { ...row, metadata: JSON.parse(row.metadata) } : null;
      }
    },
    async transaction(run) {
      const nested = db.isTransaction;
      const name = `storage_${++savepoint}`;
      db.exec(nested ? `SAVEPOINT ${name}` : "BEGIN IMMEDIATE");
      try {
        const result = await run(storage);
        db.exec(nested ? `RELEASE ${name}` : "COMMIT");
        return result;
      } catch (error) {
        try {
          if (db.isTransaction) {
            if (nested) db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
            else db.exec("ROLLBACK");
          }
        } catch { /* Preserve the operation's original failure. */ }
        throw error;
      }
    }
  };
  return storage;
}

export function openSqlite(dbPath: string): StorageConnection {
  const db = createDatabase(dbPath);
  try { return { storage: sqliteStorage(db), close: () => db.close() }; }
  catch (error) { db.close(); throw error; }
}

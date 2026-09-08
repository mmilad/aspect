import path from "node:path";
import type { StorageConnection, StorageFactory } from "./contracts/storage";
import { defaultDatabasePath } from "./environment";
import { openSqlite } from "./adapters/sqlite";
import { createServices, type DatabaseOperations } from "./services";

export interface ControllerOptions {
  path?: string;
  idleMs?: number;
  /** Storage-neutral injection for adapter contract tests and future backends. */
  storageFactory?: StorageFactory;
  skipPresets?: boolean;
  forcePresets?: boolean;
}

export type DatabaseController = DatabaseOperations & { shutdown(): Promise<void> };

export function createDatabaseController(options: ControllerOptions = {}): DatabaseController {
  const factory = options.storageFactory ?? (() => openSqlite(options.path ?? defaultDatabasePath()));
  let connection: StorageConnection | undefined;
  let services: DatabaseOperations | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopping: Promise<void> | undefined;
  const cancelIdle = () => { if (timer) clearTimeout(timer); timer = undefined; };
  const close = async () => {
    const owned = connection;
    connection = undefined; services = undefined;
    if (owned) await owned.close();
  };
  const initialize = async () => {
    if (services) return services;
    const owned = await factory();
    try {
      const next = createServices(owned.storage);
      if (!(options.skipPresets ?? process.env.PROJECTPLANER_PRESETS_SKIP === "1")) {
        await next.presets.ensure({ force: options.forcePresets });
        await next.llmJsonSchemas.ensure({ force: options.forcePresets });
      }
      connection = owned; services = next;
      return next;
    } catch (error) { try { await owned.close(); } catch { } throw error; }
  };
  const schedule = (run: (api: DatabaseOperations) => unknown): Promise<unknown> => {
    if (stopped) return Promise.reject(new Error("Database controller is shut down."));
    pending++; cancelIdle();
    const result = queue.then(async () => run(await initialize()));
    queue = result.catch(() => undefined).finally(() => {
      pending--;
      if (!pending && !stopped) {
        timer = setTimeout(() => {
          timer = undefined;
          // Closing participates in the queue so an arriving operation cannot race it.
          queue = queue.then(close).catch(error => { console.error("Database idle close failed", error); });
        }, options.idleMs ?? 5000);
        timer.unref();
      }
    });
    return result;
  };
  const groups = ["entities", "relations", "projects", "workspaces", "tasks", "tags", "snapshots", "assistantSessions",
    "llmJsonSchemas", "query", "persist", "workflows", "presets", "examples", "semantic", "rollup"] as const;
  const controller = Object.fromEntries(groups.map(group => [group, new Proxy({}, {
    get: (_target, method) => {
      if (typeof method !== "string" || method === "then" || method === "toJSON") return undefined;
      return (...args: unknown[]) => schedule(api => {
        const operations = api[group] as unknown as Record<string, (...args: unknown[]) => unknown>;
        if (typeof operations[method] !== "function") throw new Error(`Unknown database operation ${group}.${method}`);
        return operations[method](...args);
      });
    }
  })])) as DatabaseController;
  controller.shutdown = () => {
    if (!stopping) { stopped = true; cancelIdle(); stopping = queue.then(close); }
    return stopping;
  };
  return controller;
}

const state = globalThis as typeof globalThis & { projectplanerDatabaseControllers?: Map<string, DatabaseController> };
export function getDatabaseController(): DatabaseController {
  const dbPath = defaultDatabasePath();
  const resolved = dbPath === ":memory:" ? dbPath : path.resolve(dbPath);
  const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const controllers = state.projectplanerDatabaseControllers ??= new Map();
  let controller = controllers.get(key);
  if (!controller) {
    controller = createDatabaseController({ path: dbPath });
    controllers.set(key, controller);
  }
  return controller;
}

import type { Entity, EntityStore, QueryPlan, JsonRecord } from "@projectplaner/core";
import type { Operations as Entities } from "./entities";
import type { Operations as Relations } from "./relations";
import type { Operations as Projects } from "./projects";
import type { Operations as Workspaces } from "./project-workspaces";
import type { Operations as Tasks } from "./tasks";
import type { Operations as Tags } from "./tags";
import type { Operations as Snapshots } from "./snapshots";
import type { Operations as Sessions } from "./assistant-sessions";
import type { Operations as Schemas } from "./llm-json-schemas";
import type { Operations as Persist } from "./persist";

export interface Storage {
  entities: Entities;
  relations: Relations;
  projects: Projects & {
    findByKey(key: string): Promise<{ id: string; key: string; archivedAt: string | null } | null>;
    keyForId(id: string): Promise<string | undefined>;
  };
  workspaces: Workspaces;
  tasks: Tasks;
  tags: Tags;
  snapshots: Snapshots;
  assistantSessions: Sessions;
  llmJsonSchemas: Schemas;
  persist: Persist;
  query: {
    execute(plan: QueryPlan): Promise<Entity[]>;
    validate(projectId: string): Promise<{ errors: string[]; warnings: string[] }>;
  };
  catalog: {
    findPreset(projectKey: string, presetKey: string): Promise<{ id: string; projectId: string; metadata: JsonRecord; title: string } | null>;
  };
  transaction<T>(run: (storage: Storage) => Promise<T>): Promise<T>;
}

export interface StorageConnection {
  storage: Storage;
  close(): void | Promise<void>;
}

export type StorageFactory = () => StorageConnection | Promise<StorageConnection>;

export function entityStore(storage: Pick<Storage, "entities" | "relations" | "query">): EntityStore {
  return {
    getById: (id) => storage.entities.get(id),
    execute: (plan) => storage.query.execute(plan),
    listRelations: (projectKey) => storage.relations.list({ projectKey })
  };
}

import type { Storage } from "./contracts/storage";
import { rollupParentStatus } from "./rollup";
import { ensureWorkflowPresets, findSeededWorkflowPreset, markWorkflowPresetDirty } from "./presets";
import { runWorkflow, advanceWorkflowRun, resolveWorkflowFlow } from "./workflows/execute";
import { createExampleProject } from "./example-signal-desk";
import * as semantic from "./semantic/operations";

/** Domain orchestration operates on the same scoped storage during a transaction. */
export function domainStorage(raw: Storage): Storage {
  const storage: Storage = {
    ...raw,
    transaction: (run) => raw.transaction((scope) => run(domainStorage(scope))),
    entities: {
      ...raw.entities,
      create: (input) => raw.transaction(async (scope) => {
        const result = await scope.entities.create(input);
        if (!input.skipRollup) await rollupParentStatus(domainStorage(scope), result.entity.id, { projectKey: input.projectKey });
        return result;
      }),
      update: (input) => raw.transaction(async (scope) => {
        const before = input.patch.status === undefined ? null : await scope.entities.get(input.id);
        const result = await scope.entities.update(input);
        if (!input.skipRollup && input.patch.status !== undefined && input.patch.status !== before?.status) await rollupParentStatus(domainStorage(scope), result.id);
        return result;
      }),
      remove: (id) => raw.transaction((scope) => scope.entities.remove(id))
    },
    tasks: {
      create: (input) => raw.transaction(async scope => {
        const result = await scope.tasks.create(input);
        if (!input.skipRollup) await rollupParentStatus(domainStorage(scope), result.id, { projectKey: input.projectKey });
        return result;
      })
    },
    relations: {
      ...raw.relations,
      create: (input) => raw.transaction((scope) => scope.relations.create(input)),
      update: (input) => raw.transaction((scope) => scope.relations.update(input)),
      remove: (id) => raw.transaction((scope) => scope.relations.remove(id))
    }
  };
  return storage;
}

export function createServices(raw: Storage) {
  const db = domainStorage(raw);
  return {
    entities: db.entities, relations: db.relations, projects: db.projects, workspaces: db.workspaces,
    tasks: db.tasks, tags: db.tags, snapshots: db.snapshots, assistantSessions: db.assistantSessions, agentRuns: db.agentRuns,
    llmJsonSchemas: db.llmJsonSchemas, query: db.query, persist: db.persist,
    workflows: {
      run: (input: Parameters<typeof runWorkflow>[1]) => runWorkflow(db, input),
      advance: (input: Parameters<typeof advanceWorkflowRun>[1]) => advanceWorkflowRun(db, input),
      resolve: (input: Parameters<typeof resolveWorkflowFlow>[1]) => resolveWorkflowFlow(db, input)
    },
    presets: {
      ensure: (options?: Parameters<typeof ensureWorkflowPresets>[1]) => ensureWorkflowPresets(db, options),
      find: (key: string, projectKey?: string) => findSeededWorkflowPreset(db, key, projectKey),
      markDirty: (id: string) => markWorkflowPresetDirty(db, id)
    },
    examples: { create: () => db.transaction(scope => createExampleProject(scope)) },
    semantic: {
      createAspect: (projectKey: string, input: Parameters<typeof semantic.createAspect>[2]) => db.transaction(scope => semantic.createAspect(scope, projectKey, input)),
      createFeature: (projectKey: string, input: Parameters<typeof semantic.createFeature>[2]) => db.transaction(scope => semantic.createFeature(scope, projectKey, input)),
      createTask: (projectKey: string, input: Parameters<typeof semantic.createTask>[2]) => db.transaction(scope => semantic.createTask(scope, projectKey, input))
    },
    rollup: { parents: (id: string, options?: Parameters<typeof rollupParentStatus>[2]) => db.transaction(scope => rollupParentStatus(scope, id, options)) }
  };
}

export type DatabaseOperations = ReturnType<typeof createServices>;

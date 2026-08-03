import { describe, expect, it } from "vitest";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { runMigrations } from "./migrate";
import {
  createEntity,
  exportGenericPlan,
  getGenericProjectSnapshot,
  getProjectSnapshot,
  importGenericPlan,
  seedSelfPlanningProject
} from "./repository";

function createTestDatabase(): DatabaseSyncType {
  const sqlite = process.getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseSyncType };
  const db = new sqlite.DatabaseSync(":memory:");
  runMigrations(db);
  return db;
}

describe("generic entity repository", () => {
  it("migrates seeded data into generic entities", async () => {
    const db = createTestDatabase();
    await seedSelfPlanningProject(db);

    const generic = await getGenericProjectSnapshot(db, "PLAN");
    const legacy = await getProjectSnapshot(db, "PLAN");

    expect(generic?.entities.some((entity) => entity.id === "node_graph_view" && entity.type === "aspect")).toBe(true);
    expect(generic?.entities.some((entity) => entity.id === "feature_graph_navigation" && entity.type === "feature")).toBe(true);
    expect(generic?.entities.some((entity) => entity.id === "task_graph_drag" && entity.type === "task")).toBe(true);
    expect(generic?.relations.some((relation) => relation.sourceEntityId === "task_graph_drag" && relation.targetEntityId === "feature_graph_navigation")).toBe(true);
    expect(legacy?.tasks.map((task) => task.id)).toContain("task_graph_drag");

    db.close();
  });

  it("rejects generic task creation without context", async () => {
    const db = createTestDatabase();
    await seedSelfPlanningProject(db);

    await expect(createEntity(db, { projectKey: "PLAN", type: "task", title: "Contextless task" })).rejects.toThrow(
      "Task task_"
    );

    db.close();
  });

  it("adapts generic task creation into the legacy snapshot shape", async () => {
    const db = createTestDatabase();
    await seedSelfPlanningProject(db);

    const result = await createEntity(db, {
      projectKey: "PLAN",
      type: "task",
      title: "Use generic controls from tests",
      metadata: { priority: "medium", acceptanceCriteria: ["Task appears through the legacy adapter."] },
      relations: [{ targetEntityId: "node_domain", type: "affects", isPrimary: true }]
    });
    const legacy = await getProjectSnapshot(db, "PLAN");

    expect(legacy?.tasks.map((task) => task.id)).toContain(result.entity.id);
    expect(legacy?.taskLinks.some((link) => link.taskId === result.entity.id && link.targetId === "node_domain")).toBe(true);

    db.close();
  });

  it("exports and imports generic project state", async () => {
    const source = createTestDatabase();
    await seedSelfPlanningProject(source);
    const exported = await exportGenericPlan(source, "PLAN");

    const target = createTestDatabase();
    await importGenericPlan(target, exported);
    const imported = await getGenericProjectSnapshot(target, "PLAN");

    expect(imported?.entities.length).toBe(exported.entities.length);
    expect(imported?.relations.length).toBe(exported.relations.length);

    source.close();
    target.close();
  });
});

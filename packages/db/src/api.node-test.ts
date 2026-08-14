import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  Api,
  createDatabase,
  createEntity,
  createTask,
  getProjectSnapshot,
  listEntities,
  listRelations
} from "./index";

function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void>) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-api-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
      "project_plan",
      "PLAN",
      "Plan",
      ""
    );
    try {
      await run(db);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

describe("project-scoped db Api", () => {
  it(
    "creates aspects, parented features, and target anchored tasks",
    withTempDb(async (db) => {
      const api = new Api(db).getProject("PLAN");

      const aspect = await api.createAspect({ title: "Workflow authoring" });
      assert.equal(aspect.entity?.type, "aspect");

      const feature = await api.createFeature({
        parentId: aspect.entity!.id,
        title: "Schema editor"
      });
      assert.equal(feature.entity?.type, "feature");

      const task = await api.createTask({
        targetId: feature.entity!.id,
        title: "Validate output contracts",
        acceptanceCriteria: ["Fails on invalid writes"]
      });
      assert.equal(task.entity?.type, "task");
      assert.equal(task.entity?.metadata.priority, "medium");

      const relations = await listRelations(db, { projectKey: "PLAN" });
      assert.ok(
        relations.some(
          (relation) =>
            relation.sourceEntityId === aspect.entity!.id &&
            relation.targetEntityId === feature.entity!.id &&
            relation.type === "contains" &&
            relation.isPrimary
        )
      );
      assert.ok(
        relations.some(
          (relation) =>
            relation.sourceEntityId === task.entity!.id &&
            relation.targetEntityId === feature.entity!.id &&
            relation.type === "implements" &&
            relation.isPrimary
        )
      );
    })
  );

  it(
    "supports parent handles and rejects invalid root targets",
    withTempDb(async (db) => {
      const api = new Api(db).getProject("PLAN");
      const aspect = await api.createAspect({ title: "Storage" });

      const feature = await api.aspect(aspect.entity!.id).createFeature({ title: "Query builder" });
      const nested = await feature.createFeature({ title: "Conditions" });
      const task = await nested.createTask({ title: "Compile filters" });

      assert.equal(feature.entity?.type, "feature");
      assert.equal(nested.entity?.type, "feature");
      assert.equal(task.entity?.type, "task");

      await assert.rejects(
        () => api.createFeature({ parentId: task.entity!.id, title: "Nope" }),
        /Expected aspect or feature/
      );
      await assert.rejects(
        () => api.createTask({ targetId: task.entity!.id, title: "Nope" }),
        /Expected aspect or feature/
      );
    })
  );

  it(
    "keeps compatibility repository exports available",
    withTempDb(async (db) => {
      const aspect = await createEntity(db, {
        projectKey: "PLAN",
        type: "aspect",
        title: "Compatibility aspect"
      });
      const listed = await listEntities(db, { projectKey: "PLAN", type: "aspect" });
      assert.ok(listed.some((entity) => entity.id === aspect.entity.id));

      const snapshot = await getProjectSnapshot(db, "PLAN");
      assert.ok(snapshot);
      assert.ok(snapshot.nodes.some((node) => node.id === aspect.entity.id));

      db.prepare(
        `INSERT INTO nodes (id, project_id, parent_id, type, slug, path, title, summary, body, status, sort_order, metadata_json)
         VALUES (?, ?, NULL, ?, ?, ?, ?, '', '', ?, 0, '{}')`
      ).run("legacy_aspect", "project_plan", "aspect", "legacy", "/legacy", "Legacy", "planned");
      db.prepare(
        `INSERT INTO entities (id, project_id, type, key, slug, title, summary, body, status, sort_order, metadata_json)
         VALUES (?, ?, ?, NULL, ?, ?, '', '', ?, 0, '{}')`
      ).run("legacy_aspect", "project_plan", "aspect", "legacy", "Legacy", "planned");
      const task = await createTask(db, {
        projectKey: "PLAN",
        title: "Legacy task helper still works",
        description: "",
        priority: "medium",
        acceptanceCriteria: [],
        targetType: "aspect",
        targetId: "legacy_aspect",
        linkType: "affects"
      });
      assert.match(task.id, /^task_/);
      assert.equal(task.key, "PLAN-1");
    })
  );
});

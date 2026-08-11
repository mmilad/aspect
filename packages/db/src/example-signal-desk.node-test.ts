import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createDatabase,
  createExampleProject,
  deleteProject,
  EXAMPLE_PROJECT_KEY,
  getProjectSnapshot
} from "./index";

describe("Signal Desk example project", () => {
  function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void>) {
    return async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-example-"));
      const dbPath = path.join(dir, "test.db");
      const db = createDatabase(dbPath);
      try {
        await run(db);
      } finally {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };
  }

  it(
    "creates nested graph with status mix; refuses duplicate; recreates after delete",
    withTempDb(async (db) => {
      const { project } = await createExampleProject(db);
      assert.equal(project.key, EXAMPLE_PROJECT_KEY);
      assert.ok(project.entityCount >= 20);

      const snapshot = await getProjectSnapshot(db, EXAMPLE_PROJECT_KEY);
      assert.ok(snapshot);
      assert.equal(snapshot.project.title, "Signal Desk");

      const root = snapshot.nodes.find((node) => node.type === "project");
      assert.ok(root);
      const rootAspects = snapshot.nodes.filter(
        (node) => node.type === "aspect" && node.parentId === root.id
      );
      assert.ok(rootAspects.length >= 3, `expected >=3 root aspects, got ${rootAspects.length}`);

      const nestedAspect = snapshot.nodes.find((node) => node.title === "Season Planning");
      assert.ok(nestedAspect);
      assert.equal(nestedAspect.parentId, "demo_aspect_editorial");

      assert.ok(snapshot.features.length >= 6);
      const nestedFeature = snapshot.features.find((feature) => feature.title === "Guest Slots");
      assert.ok(nestedFeature);
      assert.equal(nestedFeature.parentFeatureId, "demo_feat_issue_calendar");

      assert.ok(snapshot.tasks.length >= 10);
      const statuses = new Set([
        ...snapshot.nodes.map((node) => node.status),
        ...snapshot.features.map((feature) => feature.status),
        ...snapshot.tasks.map((task) => task.status)
      ]);
      for (const required of ["in_planning", "planned", "in_progress", "done", "canceled"]) {
        assert.ok(statuses.has(required), `missing status ${required}`);
      }

      await assert.rejects(() => createExampleProject(db), /already exists/i);

      await deleteProject(db, EXAMPLE_PROJECT_KEY);
      const again = await createExampleProject(db);
      assert.equal(again.project.key, EXAMPLE_PROJECT_KEY);
    })
  );
});

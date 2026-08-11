import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createDatabase,
  createProject,
  deleteProject,
  getProjectSnapshot,
  getProjectStats,
  listProjects,
  PROTECTED_PROJECT_KEY
} from "./index";

describe("project hubs CRUD", () => {
  function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void>) {
    return async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-projects-"));
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

  it(
    "lists, creates with root entity, stats, and blocks PLAN delete",
    withTempDb(async (db) => {
      const listed = await listProjects(db);
      assert.equal(listed.length, 1);
      assert.equal(listed[0]!.key, "PLAN");

      const created = await createProject(db, { key: "demo", title: "Demo Project" });
      assert.equal(created.project.key, "DEMO");
      assert.equal(created.project.title, "Demo Project");
      assert.equal(created.project.entityCount, 1);

      const snapshot = await getProjectSnapshot(db, "DEMO");
      assert.ok(snapshot);
      assert.equal(snapshot.project.key, "DEMO");
      assert.ok(snapshot.nodes.some((node) => node.type === "project"));

      const stats = await getProjectStats(db, "DEMO");
      assert.ok(stats);
      assert.equal(stats.byType.project?.total, 1);
      assert.equal(stats.byType.project?.inProgress, 1);
      assert.equal(stats.workflowDefs, 0);

      await assert.rejects(() => deleteProject(db, PROTECTED_PROJECT_KEY), /protected/i);

      const deleted = await deleteProject(db, "DEMO");
      assert.equal(deleted.deleted, "DEMO");
      assert.equal((await listProjects(db)).length, 1);
      assert.equal(await getProjectStats(db, "DEMO"), null);
    })
  );

  it(
    "rejects invalid keys and duplicates",
    withTempDb(async (db) => {
      await assert.rejects(() => createProject(db, { key: "bad-key", title: "X" }), /key/i);
      await assert.rejects(() => createProject(db, { key: "PLAN", title: "Dup" }), /already exists/i);
      await assert.rejects(() => createProject(db, { key: "OK", title: "   " }), /title/i);
    })
  );
});

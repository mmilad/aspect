import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createDatabase
} from "./support";
import entities from "./entities";

describe("parent status rollup", () => {
  function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void>) {
    return async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-rollup-"));
      const dbPath = path.join(dir, "test.db");
      const db = createDatabase(dbPath);
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
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
    "update_task status rolls Feature then Aspect to in_progress",
    withTempDb(async (db) => {
      const aspect = await entities.create(db, {
        projectKey: "PLAN",
        type: "aspect",
        title: "Domain",
        status: "planned",
        skipRollup: true
      });

      const feature = await entities.create(db, {
        projectKey: "PLAN",
        type: "feature",
        title: "Child feature",
        status: "planned",
        skipRollup: true,
        relations: [
          {
            targetEntityId: aspect.entity.id,
            type: "implements",
            isPrimary: true
          }
        ]
      });

      const task = await entities.create(db, {
        projectKey: "PLAN",
        type: "task",
        title: "Do the thing",
        status: "planned",
        skipRollup: true,
        relations: [
          {
            targetEntityId: feature.entity.id,
            type: "implements",
            isPrimary: true
          }
        ]
      });

      await entities.update(db, {
        id: task.entity.id,
        patch: { status: "in_progress" }
      });

      const updatedFeature = await entities.get(db, feature.entity.id);
      const updatedAspect = await entities.get(db, aspect.entity.id);
      assert.equal(updatedFeature?.status, "in_progress");
      assert.equal(updatedAspect?.status, "in_progress");
    })
  );

  it(
    "all done children roll parent to done",
    withTempDb(async (db) => {
      const aspect = await entities.create(db, {
        projectKey: "PLAN",
        type: "aspect",
        title: "Done domain",
        status: "in_progress",
        skipRollup: true
      });

      const feature = await entities.create(db, {
        projectKey: "PLAN",
        type: "feature",
        title: "Done feature",
        status: "in_progress",
        skipRollup: true,
        relations: [
          {
            targetEntityId: aspect.entity.id,
            type: "implements",
            isPrimary: true
          }
        ]
      });

      const task = await entities.create(db, {
        projectKey: "PLAN",
        type: "task",
        title: "Finish",
        status: "in_progress",
        skipRollup: true,
        relations: [
          {
            targetEntityId: feature.entity.id,
            type: "implements",
            isPrimary: true
          }
        ]
      });

      await entities.update(db, {
        id: task.entity.id,
        patch: { status: "done" }
      });

      const updatedFeature = await entities.get(db, feature.entity.id);
      const updatedAspect = await entities.get(db, aspect.entity.id);
      assert.equal(updatedFeature?.status, "done");
      assert.equal(updatedAspect?.status, "done");
    })
  );
});

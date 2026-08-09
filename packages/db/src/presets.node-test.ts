import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createDatabase,
  createEntity,
  ensureWorkflowPresets,
  listEntities,
  loadWorkflowGraph,
  updateEntity
} from "./index";

describe("ensureWorkflowPresets", () => {
  function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void>) {
    return async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-presets-"));
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
    "seeds once then skips",
    withTempDb(async (db) => {
      const first = await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      assert.ok(first.seeded.includes("ensure_aspect"));
      assert.deepEqual(first.skipped, []);

      const second = await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      assert.deepEqual(second.seeded, []);
      assert.ok(second.skipped.includes("ensure_aspect"));

      const flows = await listEntities(db, { projectKey: "PLAN", type: "flow" });
      const presetFlows = flows.filter((flow) => flow.metadata.presetKey === "ensure_aspect");
      assert.equal(presetFlows.length, 1);
      const graph = loadWorkflowGraph(db, presetFlows[0]!.id);
      assert.ok(graph);
      assert.ok(graph.nodes.length > 3);
    })
  );

  it(
    "force reseeds same flow id and restores pack title/nodes",
    withTempDb(async (db) => {
      await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      const before = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).find(
        (flow) => flow.metadata.presetKey === "ensure_aspect"
      );
      assert.ok(before);

      await updateEntity(db, {
        id: before.id,
        patch: {
          title: "Mutated Ensure Aspect",
          metadata: { ...before.metadata, presetDirty: true }
        }
      });

      const force = await ensureWorkflowPresets(db, { projectKey: "PLAN", force: true });
      assert.ok(force.reseeded.includes("ensure_aspect"));
      assert.deepEqual(force.seeded, []);
      assert.ok(force.warnings.some((warning) => warning.includes("dirty")));

      const after = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).filter(
        (flow) => flow.metadata.presetKey === "ensure_aspect"
      );
      assert.equal(after.length, 1);
      assert.equal(after[0]!.id, before.id);
      assert.equal(after[0]!.title, "Ensure Aspect");
      assert.equal(after[0]!.metadata.presetDirty, false);
      const graph = loadWorkflowGraph(db, after[0]!.id);
      assert.ok(graph);
      assert.ok(graph.nodes.length > 3);
    })
  );

  it(
    "does not remove unrelated flows on force",
    withTempDb(async (db) => {
      await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      await createEntity(db, {
        projectKey: "PLAN",
        type: "flow",
        title: "User workflow",
        summary: "custom",
        status: "planned",
        metadata: {}
      });
      await ensureWorkflowPresets(db, { projectKey: "PLAN", force: true });
      const flows = await listEntities(db, { projectKey: "PLAN", type: "flow" });
      assert.ok(flows.some((flow) => flow.title === "User workflow"));
      assert.equal(flows.filter((flow) => flow.metadata.presetKey === "ensure_aspect").length, 1);
    })
  );
});

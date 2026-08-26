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
  listRelations,
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
      assert.ok(first.seeded.includes("create_step"));
      assert.ok(first.seeded.includes("create_workflow"));
      assert.ok(first.seeded.includes("create_task"));
      assert.deepEqual(first.skipped, []);
      assert.equal(first.seeded.includes("ensure_aspect"), false);

      const second = await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      assert.deepEqual(second.seeded, []);
      assert.ok(second.skipped.includes("create_step"));

      const flows = await listEntities(db, { projectKey: "PLAN", type: "flow" });
      const presetFlows = flows.filter((flow) => flow.metadata.presetKey === "create_step");
      assert.equal(presetFlows.length, 1);
      const graph = loadWorkflowGraph(db, presetFlows[0]!.id);
      assert.ok(graph);
      assert.ok(graph.nodes.length > 3);
      assert.ok(graph.variables?.some((variable) => variable.name === "stepInstructions"));
      assert.equal(presetFlows[0]!.metadata.presetKind, "builder");
      const createWorkflow = flows.find((flow) => flow.metadata.presetKey === "create_workflow");
      assert.equal(createWorkflow?.metadata.presetKind, "builder");
      const createTask = flows.find((flow) => flow.metadata.presetKey === "create_task");
      assert.equal(createTask?.metadata.presetKind, "mutation");
    })
  );

  it(
    "skip path stamps presetKind without replacing the graph",
    withTempDb(async (db) => {
      await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      const before = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).find(
        (flow) => flow.metadata.presetKey === "create_step"
      );
      assert.ok(before);
      const nodeCount = loadWorkflowGraph(db, before.id)?.nodes.length;
      const { presetKind: _removed, ...metadataWithoutKind } = before.metadata;

      await updateEntity(db, {
        id: before.id,
        patch: {
          title: "Mutated Create Step",
          metadata: metadataWithoutKind
        }
      });

      const skip = await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      assert.ok(skip.skipped.includes("create_step"));
      assert.deepEqual(skip.reseeded, []);
      assert.deepEqual(skip.seeded, []);

      const after = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).find(
        (flow) => flow.metadata.presetKey === "create_step"
      );
      assert.ok(after);
      assert.equal(after.title, "Mutated Create Step");
      assert.equal(after.metadata.presetKind, "builder");
      assert.equal(loadWorkflowGraph(db, after.id)?.nodes.length, nodeCount);
    })
  );

  it(
    "links builder presets to a feature key without force-reseed",
    withTempDb(async (db) => {
      const feature = await createEntity(db, {
        projectKey: "PLAN",
        type: "feature",
        title: "Workflow Builder Pipeline",
        summary: "test target",
        status: "in_progress",
        key: "FEAT-24"
      });

      const first = await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["create_workflow"] });
      assert.ok(first.seeded.includes("create_workflow"));

      const flow = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).find(
        (entity) => entity.metadata.presetKey === "create_workflow"
      );
      assert.ok(flow);
      const relations = await listRelations(db, { sourceEntityId: flow.id });
      assert.ok(
        relations.some(
          (relation) => relation.targetEntityId === feature.entity.id && relation.type === "supports"
        )
      );
    })
  );

  it(
    "force reseeds same flow id and restores pack title/nodes",
    withTempDb(async (db) => {
      await ensureWorkflowPresets(db, { projectKey: "PLAN" });
      const before = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).find(
        (flow) => flow.metadata.presetKey === "create_step"
      );
      assert.ok(before);

      await updateEntity(db, {
        id: before.id,
        patch: {
          title: "Mutated Create Step",
          metadata: { ...before.metadata, presetDirty: true }
        }
      });

      const force = await ensureWorkflowPresets(db, { projectKey: "PLAN", force: true });
      assert.ok(force.reseeded.includes("create_step"));
      assert.deepEqual(force.seeded, []);
      assert.ok(force.warnings.some((warning) => warning.includes("dirty")));

      const after = (await listEntities(db, { projectKey: "PLAN", type: "flow" })).filter(
        (flow) => flow.metadata.presetKey === "create_step"
      );
      assert.equal(after.length, 1);
      assert.equal(after[0]!.id, before.id);
      assert.equal(after[0]!.title, "Create step");
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
      assert.equal(flows.filter((flow) => flow.metadata.presetKey === "create_step").length, 1);
    })
  );
});

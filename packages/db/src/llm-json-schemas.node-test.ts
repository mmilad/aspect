import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import workflow from "@projectplaner/core/workflow";

const { createContextBag, parse: parseWorkflowGraph } = workflow.graph;
const { WORKFLOW_SCHEMA_VERSION } = workflow.nodes;
const {
  LLM_JSON_SCHEMA_PRESETS,
  WORKFLOW_IR_V1_KEY,
  WORKFLOW_IR_V1_SCHEMA,
  WORKFLOW_NODE_PLAN_V1_KEY,
  WORKFLOW_NODE_QA_V1_KEY,
  WORKFLOW_STEP_DRAFT_V1_KEY,
  WORKFLOW_STEP_LIST_V1_KEY
} = workflow.llm;
import {
  createDatabase
} from "./index";
import entities from "./repositories/entities";
import llmJsonSchemas from "./repositories/llm-json-schemas";
import persist from "./workflows/persist";
import { advanceWorkflowRun } from "./workflows/execute";

describe("llm_json_schemas", () => {
  function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void> | void) {
    return async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-ljs-"));
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
    "creates tables and seeds catalog schemas once",
    withTempDb((db) => {
      const keys = LLM_JSON_SCHEMA_PRESETS.map((preset) => preset.key);
      const first = llmJsonSchemas.ensure(db, { projectKey: "PLAN" });
      assert.deepEqual(first.seeded, keys);
      assert.deepEqual(first.skipped, []);

      const second = llmJsonSchemas.ensure(db, { projectKey: "PLAN" });
      assert.deepEqual(second.seeded, []);
      assert.deepEqual(second.skipped, keys);

      const row = llmJsonSchemas.getByKey(db, WORKFLOW_IR_V1_KEY, "PLAN");
      assert.ok(row);
      assert.equal(row.version, 1);
      assert.equal(row.status, "active");
      assert.deepEqual(row.schema, WORKFLOW_IR_V1_SCHEMA);
      assert.equal(llmJsonSchemas.list(db, "PLAN").length, keys.length);
    })
  );

  it(
    "force reseeds and bumps version when schema_json changes",
    withTempDb((db) => {
      llmJsonSchemas.ensure(db, { projectKey: "PLAN" });
      const before = llmJsonSchemas.getByKey(db, WORKFLOW_IR_V1_KEY, "PLAN");
      assert.ok(before);

      db.prepare(`UPDATE llm_json_schemas SET schema_json = ? WHERE id = ?`).run(
        JSON.stringify({ type: "object", properties: {} }),
        before.id
      );

      const force = llmJsonSchemas.ensure(db, { projectKey: "PLAN", force: true });
      assert.deepEqual(force.reseeded, [WORKFLOW_IR_V1_KEY]);

      const after = llmJsonSchemas.getByKey(db, WORKFLOW_IR_V1_KEY, "PLAN");
      assert.ok(after);
      assert.equal(after.version, 2);
      assert.deepEqual(after.schema, WORKFLOW_IR_V1_SCHEMA);

      const versions = db
        .prepare(`SELECT version FROM llm_json_schema_versions WHERE schema_id = ? ORDER BY version`)
        .all(after.id) as { version: number }[];
      assert.deepEqual(
        versions.map((row) => row.version),
        [1, 2]
      );
    })
  );

  it(
    "LLM node schemaKey resolves from SQLite and snapshots on node_run",
    withTempDb(async (db) => {
      llmJsonSchemas.ensure(db, { projectKey: "PLAN" });
      const seeded = llmJsonSchemas.getByKey(db, WORKFLOW_IR_V1_KEY, "PLAN");
      assert.ok(seeded);

      const flow = await entities.create(db, {
        projectKey: "PLAN",
        type: "flow",
        title: "IR draft",
        summary: "schemaKey smoke",
        status: "planned"
      });
      const graph = {
        version: WORKFLOW_SCHEMA_VERSION,
        nodes: [
          {
            id: "start",
            type: "start" as const,
            position: { x: 0, y: 0 },
            data: { title: "Start", writes: ["goal"] }
          },
          {
            id: "draft",
            type: "llm" as const,
            position: { x: 200, y: 0 },
            data: {
              title: "Draft",
              writes: ["ir"],
              llm: {
                instructions: "Draft IR",
                schemaKey: WORKFLOW_IR_V1_KEY,
                outputSchema: ["ir"]
              }
            }
          },
          {
            id: "end",
            type: "end" as const,
            position: { x: 400, y: 0 },
            data: { title: "End" }
          }
        ],
        edges: [
          { id: "e1", source: "start", target: "draft", kind: "next" as const },
          { id: "e2", source: "draft", target: "end", kind: "next" as const }
        ]
      };
      const parsed = parseWorkflowGraph(graph);
      assert.equal(parsed.ok, true);
      if (!parsed.ok) {
        return;
      }
      persist.saveGraph(db, {
        workflowId: flow.entity.id,
        projectId: flow.entity.projectId,
        graph: parsed.graph
      });
      const bag = createContextBag({
        workflowId: flow.entity.id,
        goal: "ir",
        startNodeId: "start",
        keys: {}
      });
      const run = persist.createRun(db, {
        workflowId: flow.entity.id,
        projectId: flow.entity.projectId,
        graph: parsed.graph,
        bag: bag as unknown as Record<string, unknown>
      });
      const paused = await advanceWorkflowRun(db, { runId: run.id });
      assert.equal(paused.step.kind, "pending_llm");
      assert.equal(paused.step.llm?.schemaKey, WORKFLOW_IR_V1_KEY);
      assert.deepEqual(paused.step.llm?.jsonSchema, WORKFLOW_IR_V1_SCHEMA);
      assert.equal(paused.step.llm?.jsonSchemaId, seeded.id);

      const nodeRuns = persist.listNodeRuns(db, run.id);
      const waiting = nodeRuns.find((row) => row.nodeId === "draft");
      assert.ok(waiting);
      assert.equal(waiting.input.schemaKey, WORKFLOW_IR_V1_KEY);
      assert.equal(waiting.input.schemaId, seeded.id);
      assert.deepEqual(waiting.input.schema_json, WORKFLOW_IR_V1_SCHEMA);
    })
  );
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createContextBag, createStepGraph, parseWorkflowGraph } from "@projectplaner/core";
import {
  advanceWorkflowRun,
  createDatabase,
  createEntity,
  createWorkflowRun,
  ensureWorkflowPresets,
  loadWorkflowGraph,
  saveWorkflowGraph
} from "./index";

describe("advanceWorkflowRun create_step", () => {
  it("pauses on LLM then completes pin path", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-wf-runtime-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );

      const seeded = await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["create_step"] });
      assert.ok(seeded.seeded.includes("create_step") || seeded.skipped.includes("create_step"));

      const flowRow = db
        .prepare(
          `SELECT id, project_id FROM entities
           WHERE type = 'flow' AND json_extract(metadata_json, '$.presetKey') = 'create_step'`
        )
        .get() as { id: string; project_id: string };

      const parsed = parseWorkflowGraph(createStepGraph);
      assert.equal(parsed.ok, true);
      if (!parsed.ok) {
        return;
      }
      saveWorkflowGraph(db, {
        workflowId: flowRow.id,
        projectId: flowRow.project_id,
        graph: parsed.graph
      });

      const bag = createContextBag({
        workflowId: flowRow.id,
        goal: "Create step",
        startNodeId: "start",
        keys: {
          stepInstructions: "Create an LLM writer node."
        }
      });

      const run = createWorkflowRun(db, {
        workflowId: flowRow.id,
        projectId: flowRow.project_id,
        graph: parsed.graph,
        bag: bag as unknown as Record<string, unknown>
      });

      const paused = await advanceWorkflowRun(db, { runId: run.id });
      assert.equal(paused.step.kind, "pending_llm");
      assert.equal(paused.run.status, "pending_llm");
      assert.equal(paused.step.nodeId, "interpret_node_plan");

      const plan = {
        nodeType: "llm",
        title: "Writer",
        config: { instructions: "Return JSON." }
      };
      const afterFactory = await advanceWorkflowRun(db, {
        runId: run.id,
        llmWrites: { nodePlan: plan }
      });
      assert.equal(afterFactory.step.kind, "pending_llm");
      assert.equal(afterFactory.step.nodeId, "verify_node");

      const done = await advanceWorkflowRun(db, {
        runId: run.id,
        llmWrites: {
          nodeAccepted: true,
          qaReason: "ok",
          repairInstructions: "",
          improvements: []
        }
      });

      assert.equal(done.step.kind, "completed");
      assert.equal(done.run.status, "completed");
      assert.ok(done.step.bag.keys.stepDraft);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runWorkflow resolves by preset key", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-wf-key-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );
      await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["create_step"] });

      const { runWorkflow } = await import("./workflow-runtime");
      const started = await runWorkflow(db, {
        key: "create_step",
        bag: {
          stepInstructions: "Create an LLM writer node."
        }
      });
      assert.equal(started.flow.metadata.presetKey, "create_step");
      assert.equal(started.step.kind, "pending_llm");
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists data edges and variables when saving and loading workflow graphs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-wf-pins-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );

      const flow = await createEntity(db, {
        projectKey: "PLAN",
        type: "flow",
        title: "Pin persistence",
        summary: "Save/reload pin ids.",
        status: "planned",
        slug: "pin-persistence"
      });

      saveWorkflowGraph(db, {
        workflowId: flow.entity.id,
        projectId: "project_test",
        graph: createStepGraph
      });

      const loaded = loadWorkflowGraph(db, flow.entity.id);
      assert.ok(loaded);
      assert.ok(loaded.variables?.some((variable) => variable.name === "stepInstructions"));
      const toLlm = loaded.edges.find((edge) => edge.id === "e1");
      const dataWire = loaded.edges.find((edge) => edge.id === "d_start_r_instr");
      assert.equal(toLlm?.sourcePin, "then");
      assert.equal(toLlm?.targetPin, "in");
      assert.equal(dataWire?.kind, "data");
      assert.equal(dataWire?.sourcePin, "stepInstructions");
      assert.equal(dataWire?.targetPin, "value");
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists exec waypoints when saving and loading workflow graphs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-wf-waypoints-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );

      const flow = await createEntity(db, {
        projectKey: "PLAN",
        type: "flow",
        title: "Waypoint persistence",
        summary: "Save/reload exec reroute knobs.",
        status: "planned",
        slug: "waypoint-persistence"
      });

      const parsed = parseWorkflowGraph({
        version: 3,
        nodes: [
          { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
          { id: "end", type: "end", position: { x: 240, y: 0 }, data: { title: "End" } }
        ],
        edges: [
          {
            id: "e1",
            source: "start",
            target: "end",
            kind: "next",
            sourcePin: "then",
            targetPin: "in",
            waypoints: [
              { x: 80, y: 48 },
              { x: 160, y: -20 }
            ]
          }
        ]
      });
      assert.equal(parsed.ok, true);
      if (!parsed.ok) {
        return;
      }

      saveWorkflowGraph(db, {
        workflowId: flow.entity.id,
        projectId: "project_test",
        graph: parsed.graph
      });

      const loaded = loadWorkflowGraph(db, flow.entity.id);
      assert.ok(loaded);
      const edge = loaded.edges.find((item) => item.id === "e1");
      assert.deepEqual(edge?.waypoints, [
        { x: 80, y: 48 },
        { x: 160, y: -20 }
      ]);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import workflow from "@projectplaner/core/workflow";
import {
  SemanticWrites,
  createDatabase,
  ensureWorkflowPresets
} from "./support";
import entities from "./entities";
import relations from "../repositories/relations";
import persist from "../workflows/persist";
import workflows from "./support";
import { advanceWorkflowRun } from "./support";

const { createContextBag, parse: parseWorkflowGraph } = workflow.graph;
const { createStepGraph } = workflow.presets;

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
      persist.saveGraph(db, {
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

      const run = persist.createRun(db, {
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

      const started = await workflows.run(db, {
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

      const flow = await entities.create(db, {
        projectKey: "PLAN",
        type: "flow",
        title: "Pin persistence",
        summary: "Save/reload pin ids.",
        status: "planned",
        slug: "pin-persistence"
      });

      persist.saveGraph(db, {
        workflowId: flow.entity.id,
        projectId: "project_test",
        graph: createStepGraph
      });

      const loaded = persist.loadGraph(db, flow.entity.id);
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

      const flow = await entities.create(db, {
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

      persist.saveGraph(db, {
        workflowId: flow.entity.id,
        projectId: "project_test",
        graph: parsed.graph
      });

      const loaded = persist.loadGraph(db, flow.entity.id);
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

describe("runWorkflow goal_planning", () => {
  it("pauses on classify with plan.v1 and snapshot poll keeps the same runId", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-goal-planning-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );
      await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["goal_planning", "thinking"] });
      const started = await workflows.run(db, {
        key: "goal_planning",
        bag: { task: "Trading card register" }
      });
      assert.equal(started.flow.metadata.presetKey, "goal_planning");
      assert.equal(started.step.kind, "pending_llm");
      assert.equal(started.step.nodeId, "classify");
      const plan = started.step.bag.keys.plan as { schema?: string } | undefined;
      assert.equal(plan?.schema, "projectplaner.plan.v1");

      const polled = await workflows.run(db, { runId: started.run.id });
      assert.equal(polled.run.id, started.run.id);
      assert.equal(polled.step.kind, "pending_llm");
      assert.equal((polled.step.bag.keys.plan as { schema?: string } | undefined)?.schema, "projectplaner.plan.v1");
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("seals plan.v1 onto a Reference the Task references", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-goal-persist-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );
      await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["goal_planning", "thinking"] });
      const api = new SemanticWrites(db).project("PLAN");
      const aspect = await api.createAspect({ title: "Goal planning persist" });
      const task = await api.createTask({
        targetId: aspect.entity!.id,
        title: "Plan the trading card app"
      });
      const started = await workflows.run(db, {
        key: "goal_planning",
        bag: { task: "Trading card register", targetTaskId: task.entity!.id }
      });
      assert.equal(started.step.kind, "pending_llm");
      const frontierId = String(started.step.bag.keys.frontierId);
      const done = await workflows.run(db, {
        runId: started.run.id,
        llmWrites: {
          classify: {
            nodeId: frontierId,
            status: "atomic",
            reason: "The brief is already one leaf.",
            acceptance: ["One inspectable plan document exists"]
          }
        }
      });
      assert.equal(done.step.kind, "completed", done.step.message);
      const planEntityId = done.step.bag.keys.planEntityId;
      assert.equal(typeof planEntityId, "string");
      const holder = await entities.get(db, String(planEntityId));
      assert.equal(holder?.type, "reference");
      assert.equal(holder?.metadata.kind, "plan.v1");
      assert.equal(typeof holder?.metadata.workflow, "undefined");
      const document = holder?.metadata.document as { schema?: string } | undefined;
      assert.equal(document?.schema, "projectplaner.plan.v1");
      const linked = await relations.list(db, { sourceEntityId: task.entity!.id, type: "references" });
      assert.ok(linked.some((relation) => relation.targetEntityId === planEntityId));
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ensureAspectPreset, createContextBag, parseWorkflowGraph } from "@projectplaner/core";
import {
  advanceWorkflowRun,
  createDatabase,
  createEntity,
  createWorkflowRun,
  ensureWorkflowPresets,
  saveWorkflowGraph
} from "./index";

describe("advanceWorkflowRun ensure_aspect", () => {
  it("pauses on LLM then completes reuse path", async () => {
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

      await createEntity(db, {
        projectKey: "PLAN",
        type: "aspect",
        title: "Should author executable workflow step graphs",
        summary: "Executable workflow diagrams.",
        status: "done",
        slug: "should-author-executable-workflow-step-graphs"
      });

      const seeded = await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["ensure_aspect"] });
      assert.ok(seeded.seeded.includes("ensure_aspect") || seeded.skipped.includes("ensure_aspect"));

      const flowRow = db
        .prepare(
          `SELECT id, project_id FROM entities
           WHERE type = 'flow' AND json_extract(metadata_json, '$.presetKey') = 'ensure_aspect'`
        )
        .get() as { id: string; project_id: string };

      const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
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
        goal: "Ensure Aspect",
        startNodeId: "start",
        keys: {
          title: "Should author branching workflow diagrams with LLM steps",
          reason: "Runtime reuse path test."
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

      const existingId = (
        db
          .prepare(`SELECT id FROM entities WHERE slug = ?`)
          .get("should-author-executable-workflow-step-graphs") as { id: string }
      ).id;

      const done = await advanceWorkflowRun(db, {
        runId: run.id,
        llmWrites: {
          aspectId: existingId,
          createNew: false,
          confidence: 0.95
        }
      });

      assert.equal(done.step.kind, "completed");
      assert.equal(done.run.status, "completed");
      assert.equal(done.step.bag.keys.aspectId, existingId);
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
      await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["ensure_aspect"] });

      const { runWorkflow } = await import("./workflow-runtime");
      const started = await runWorkflow(db, {
        key: "ensure_aspect",
        bag: {
          title: "Should discover and run workflow presets from MCP",
          reason: "Key lookup smoke."
        }
      });
      assert.equal(started.flow.metadata.presetKey, "ensure_aspect");
      assert.equal(started.step.kind, "pending_llm");
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

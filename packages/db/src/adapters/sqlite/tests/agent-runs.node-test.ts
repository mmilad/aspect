import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDatabase } from "../client";
import runs from "../repositories/agent-runs";
import type { AgentRun } from "@projectplaner/core";
import { ensureWorkflowPresets, runWorkflow } from "./support";

test("recruitment searches, builds a profile and persists a normalized agent", async () => {
  const db = createDatabase(":memory:");
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ results: [{ title: "Role", url: "https://example.test", content: "Build software" }] });
  try {
    db.exec("INSERT INTO projects(id,key,title) VALUES('p','PLAN','Plan')");
    await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["recruit_agent"] });
    const started = await runWorkflow(db, { key: "recruit_agent", projectKey: "PLAN", bag: { query: "Coding", maxResults: 1 } });
    assert.equal(started.step.kind, "pending_llm");
    assert.equal(started.step.nodeId, "summarize");
    const profiled = await runWorkflow(db, { runId: started.run.id, llmWrites: { responsibilities: "Build software" } });
    assert.equal(profiled.step.kind, "pending_llm");
    const done = await runWorkflow(db, { runId: started.run.id, llmWrites: { profile: { name: "Coder", role: "Coding", responsibilities: ["Build software"] } } });
    assert.equal(done.step.kind, "completed");
    const row = db.prepare("SELECT metadata_json FROM entities WHERE type='agent'").get() as { metadata_json: string };
    const profile = JSON.parse(row.metadata_json).document;
    assert.equal(profile.name, "Coder");
    assert.equal(profile.contextPolicy.memoryEnabled, false);
    assert.equal(profile.runtimePolicy.maxSteps, 20);
  } finally { globalThis.fetch = previous; db.close(); }
});

test("terminal transitions preserve the winner and roll back event failures", () => {
  const db = createDatabase(":memory:");
  try {
    db.exec("INSERT INTO projects(id,key,title) VALUES('p','PLAN','Plan'); INSERT INTO entities(id,project_id,type,slug,title,status) VALUES('a','p','agent','a','Agent','planned')");
    const run: AgentRun = { id: "run", agentId: "a", projectKey: "PLAN", task: "task",
      status: "running", startedAt: "now", stepCount: 1, workflowCallCount: 0 };
    runs.create(db, run);
    const canceled = { ...run, status: "canceled" as const, finishedAt: "later" };
    runs.finish(db, canceled);
    runs.finish(db, canceled);
    assert.equal(runs.finish(db, { ...run, status: "completed", result: "late" }).status, "canceled");
    assert.equal(runs.listEvents(db, run.id).length, 1);
    runs.create(db, { ...run, id: "other" });
    db.exec("CREATE TRIGGER reject_event BEFORE INSERT ON agent_run_events BEGIN SELECT RAISE(ABORT, 'event failure'); END");
    assert.throws(() => runs.finish(db, { ...run, id: "other", status: "completed", result: "answer" }), /event failure/);
    assert.equal(runs.get(db, "other")?.status, "running");
    assert.equal(runs.listEvents(db, "other").length, 0);
    db.exec("DROP TRIGGER reject_event");
    runs.finish(db, { ...run, id: "other", status: "completed", result: "answer" });
    assert.equal(runs.finish(db, { ...run, id: "other", status: "failed" }).result, "answer");
  } finally { db.close(); }
});

test("agent runs and events survive a v1 upgrade and replay same-time events in insertion order", t => {
  const dir = mkdtempSync(path.join(tmpdir(), "agent-runs-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "test.db");
  let db = createDatabase(file);
  db.exec("INSERT INTO projects(id,key,title) VALUES('p','PLAN','Plan'); INSERT INTO entities(id,project_id,type,slug,title,status) VALUES('a','p','agent','a','Agent','planned')");
  const run: AgentRun = { id: "run", agentId: "a", projectKey: "PLAN", task: "Task", status: "running", stepCount: 0, workflowCallCount: 0, startedAt: "now" };
  runs.create(db, run);
  runs.update(db, { ...run, status: "completed", result: "answer" });
  for (const [id, type] of [["z", "run_started"], ["a", "run_completed"]] as const) {
    runs.createEvent(db, { id, runId: run.id, type, message: "status", createdAt: "same" });
  }
  db.exec("PRAGMA user_version=1");
  db.close();
  db = createDatabase(file);
  assert.equal(runs.get(db, "run")?.result, "answer");
  assert.equal(runs.list(db, "a", "PLAN").length, 1);
  assert.deepEqual(runs.listEvents(db, "run").map(e => e.id), ["z", "a"]);
  assert.deepEqual(runs.listEvents(db, "run", "z").map(e => e.id), ["a"]);
  assert.deepEqual(runs.listEvents(db, "run", "a"), []);
  assert.equal(runs.listEvents(db, "run", "unknown").length, 2);
  assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 2);
  db.close();
  // Simulate an old v1 database that never had either additive table.
  const old = new DatabaseSync(file);
  old.exec("DROP TABLE agent_run_events; DROP TABLE agent_runs; PRAGMA user_version=1");
  old.close();
  db = createDatabase(file);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entities WHERE type='agent'").get()?.n, 1);
  assert.deepEqual(runs.list(db, "a"), []);
  assert.deepEqual(runs.listEvents(db, "missing"), []);
  db.close();
});

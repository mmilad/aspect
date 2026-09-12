import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assistant from "@projectplaner/core/assistant";
import { createDatabase, ensureWorkflowPresets } from "./support";
import assistantSessions from "../repositories/assistant-sessions";
import entities from "./entities";
import { runWorkflow } from "./support";

const { commitAssistantTurn, emptySession, parseContextPack } = assistant;

const pack = {
  summary: { text: "Graph inspect" },
  topics: [
    { id: "t_graph", title: "Graph inspect", status: "active", weight: 1 },
    { id: "t_auth", title: "Auth", status: "parked", weight: 0.2 }
  ],
  questions: [],
  context: { projectKey: "PLAN" }
};

describe("assistant_turn persist", () => {
  it("writes contextPack and reply to End, then session save keeps standing fields", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-asst-turn-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );
      await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["assistant_turn"] });

      const record = assistantSessions.create(db, "PLAN");
      const started = await runWorkflow(db, {
        key: "assistant_turn",
        projectKey: "PLAN",
        bag: {
          session: emptySession("PLAN"),
          message: "Look at the graph"
        }
      });
      assert.equal(started.step.kind, "pending_llm");
      assert.equal(started.step.nodeId, "llm_context");

      const afterA = await runWorkflow(db, {
        runId: started.run.id,
        llmWrites: { contextPack: pack }
      });
      assert.equal(afterA.step.kind, "pending_llm");
      assert.equal(afterA.step.nodeId, "llm_decide");

      const afterDecision = await runWorkflow(db, {
        runId: started.run.id,
        llmWrites: {
          decision: {
            route: "reply",
            reason: "The supplied context is enough.",
            question: null,
            lookup: null,
            lookupKind: null,
            lookupQuery: null,
            lookupId: null,
            agentId: null,
            task: null,
            runId: null,
            message: null
          }
        }
      });
      assert.equal(afterDecision.step.kind, "pending_llm");
      assert.equal(afterDecision.step.nodeId, "llm_reply");

      const done = await runWorkflow(db, {
        runId: started.run.id,
        llmWrites: { reply: "Switching focus." }
      });
      assert.equal(done.step.kind, "completed");
      assert.deepEqual(done.step.bag.frame?.outputs.contextPack, pack);
      assert.equal(done.step.bag.frame?.outputs.reply, "Switching focus.");

      const parsed = parseContextPack(done.step.bag.frame?.outputs.contextPack, "PLAN");
      assert.ok(parsed);
      const saved = assistantSessions.save(
        db,
        record.id,
        commitAssistantTurn(record.session, "Look at the graph", parsed, "Switching focus.", started.run.id)
      );
      assert.equal(saved.session.summary?.text, "Graph inspect");
      assert.equal(saved.session.topics[0]?.title, "Graph inspect");
      assert.equal(saved.session.topics[0]?.status, "active");
      assert.equal(saved.session.messages.at(-1)?.content, "Switching focus.");
      assert.equal(saved.session.messages.at(-1)?.workflowRunId, started.run.id);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes real active agents from the database into the decision node", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-asst-eval-"));
    const dbPath = path.join(dir, "test.db");
    const db = createDatabase(dbPath);
    try {
      db.prepare(`INSERT INTO projects (id, key, title, description) VALUES (?, ?, ?, ?)`).run(
        "project_test",
        "PLAN",
        "Plan",
        ""
      );
      await ensureWorkflowPresets(db, { projectKey: "PLAN", only: ["assistant_turn"] });
      const agent = await entities.create(db, {
        projectKey: "PLAN",
        type: "agent",
        title: "Coding Agent",
        summary: "Builds and tests software.",
        status: "planned"
      });

      const started = await runWorkflow(db, {
        key: "assistant_turn",
        projectKey: "PLAN",
        bag: { session: emptySession("PLAN"), message: "Which agents exist?" }
      });
      assert.equal(started.step.kind, "pending_llm");

      const afterContext = await runWorkflow(db, {
        runId: started.run.id,
        llmWrites: { contextPack: pack }
      });
      assert.equal(afterContext.step.kind, "pending_llm");
      assert.equal(afterContext.step.nodeId, "llm_decide");
      const agentFacts = afterContext.step.llm?.reads.agentFacts;
      assert.ok(Array.isArray(agentFacts));
      assert.equal(agentFacts.some((item) => item && typeof item === "object" && "id" in item && item.id === agent.entity.id), true);
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assistant from "@projectplaner/core/assistant";
import { createDatabase } from "./index";
import assistantSessions from "./repositories/assistant-sessions";

const { emptySession, merge } = assistant;

describe("assistant_sessions", () => {
  function withTempDb(run: (db: ReturnType<typeof createDatabase>) => Promise<void> | void) {
    return async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectplaner-asst-"));
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
    "getOrCreateActive reuses the same row and save round-trips merge",
    withTempDb((db) => {
      const first = assistantSessions.getOrCreateActive(db, "PLAN");
      const second = assistantSessions.getOrCreateActive(db, "PLAN");
      assert.equal(first.id, second.id);
      assert.equal(first.session.messages.length, 0);

      const merged = merge(emptySession("PLAN"), {
        summary: { text: "Standing picture" },
        topics: [{ title: "Shell", status: "active", weight: 1 }],
        context: { entityId: "node_app" }
      });
      const saved = assistantSessions.save(db, first.id, merged);
      assert.equal(saved.title, "Standing picture");
      assert.equal(saved.session.summary?.text, "Standing picture");
      assert.equal(saved.contextEntityId, "node_app");
      assert.ok(saved.session.topics[0]?.id);

      const listed = assistantSessions.list(db, "PLAN");
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.id, first.id);
    })
  );

  it(
    "archive hides from default list",
    withTempDb((db) => {
      const row = assistantSessions.getOrCreateActive(db, "PLAN");
      assistantSessions.archive(db, row.id);
      assert.equal(assistantSessions.list(db, "PLAN").length, 0);
      assert.equal(assistantSessions.list(db, "PLAN", { includeArchived: true }).length, 1);
      const next = assistantSessions.getOrCreateActive(db, "PLAN");
      assert.notEqual(next.id, row.id);
    })
  );

  it(
    "create always inserts a new active session",
    withTempDb((db) => {
      const first = assistantSessions.create(db, "PLAN");
      const second = assistantSessions.create(db, "PLAN");
      assert.notEqual(first.id, second.id);
      assert.equal(assistantSessions.list(db, "PLAN").length, 2);
    })
  );
});

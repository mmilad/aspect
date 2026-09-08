import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { createDatabaseController } from "./controller";
import type { Storage } from "./contracts/storage";
import { createServices } from "./services";
import type { Entity } from "@projectplaner/core";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { withDb } from "../../../apps/web/lib/plan-api";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

function fake(get: Storage["entities"]["get"]): Storage {
  return {
    entities: { get },
    projects: { async findByKey() { return null; } },
    llmJsonSchemas: { async ensure() { return {seeded: [], skipped: [], reseeded: []}; } }
  } as unknown as Storage;
}

test("FIFO operations share one lazy connection; a rejected operation does not poison the queue", async () => {
  const gate = deferred(); const entered = deferred(); const events: string[] = [];
  let opens = 0, closes = 0;
  const db = createDatabaseController({skipPresets: true, storageFactory: () => {
    opens++;
    return {storage: fake(async id => {
      events.push(id);
      if (id === "first") { entered.resolve(); await gate.promise; }
      if (id === "fail") throw new Error("operation failed");
      return null;
    }), close() { closes++; }};
  }});
  assert.equal(opens, 0);
  const first = db.entities.get("first");
  const failure = assert.rejects(db.entities.get("fail"), /operation failed/);
  const last = db.entities.get("last");
  await entered.promise;
  assert.deepEqual(events, ["first"]);
  gate.resolve();
  await Promise.all([first, failure, last]);
  assert.deepEqual(events, ["first", "fail", "last"]);
  assert.equal(opens, 1);
  await db.shutdown(); assert.equal(closes, 1);
});

test("idle closure reopens lazily and shutdown drains already accepted operations", async () => {
  let opens = 0, closes = 0;
  const gate = deferred(); const entered = deferred();
  const db = createDatabaseController({idleMs: 15, skipPresets: true, storageFactory: () => {
    opens++; return {storage: fake(async id => {
      if (id === "hold") { entered.resolve(); await gate.promise; } return null;
    }), close() { closes++; }};
  }});
  await db.entities.get("initial"); await sleep(60);
  assert.equal(closes, 1);
  const held = db.entities.get("hold"); const queued = db.entities.get("queued");
  await entered.promise;
  const shutdown = db.shutdown();
  await assert.rejects(db.entities.get("late"), /shut down/);
  await sleep(30); assert.equal(closes, 1);
  gate.resolve(); await Promise.all([held, queued, shutdown]);
  assert.equal(opens, 2); assert.equal(closes, 2);
  await db.shutdown(); assert.equal(closes, 2);
});

test("initialization failures close their connection and subsequent calls can retry", async () => {
  let attempts = 0, closes = 0;
  const db = createDatabaseController({storageFactory: () => {
    attempts++;
    const storage = fake(async () => null);
    if (attempts === 1) storage.projects.findByKey = async () => { throw new Error("catalog unavailable"); };
    return {storage, close() { closes++; }};
  }});
  await assert.rejects(db.entities.get("first"), /catalog unavailable/);
  assert.equal(closes, 1);
  assert.equal(await db.entities.get("retry"), null);
  assert.equal(attempts, 2);
  await db.shutdown(); assert.equal(closes, 2);
});

test("shared mutation orchestration uses transaction-scoped storage with a non-SQLite adapter", async () => {
  const events: string[] = [];
  const entity: Entity = {id: "reference", projectId: "project", type: "reference", key: null, slug: "reference", title: "Reference", summary: "", body: "", status: "planned", sortOrder: 0, metadata: {}};
  const scope = fake(async () => entity);
  scope.entities.create = async () => { events.push("scoped write"); return {entity, warnings: []}; };
  const root = fake(async () => null);
  root.entities.create = async () => { throw new Error("unscoped write"); };
  root.transaction = async run => {
    events.push("begin"); const result = await run(scope); events.push("commit"); return result;
  };
  const result = await createServices(root).entities.create({projectKey: "PLAN", type: "reference", title: "Reference"});
  assert.equal(result.entity, entity);
  assert.deepEqual(events, ["begin", "scoped write", "commit"]);
});

test("a web callback waiting for external work does not occupy the database queue", async () => {
  const entered = deferred(), external = deferred();
  const events: string[] = [];
  const db = createDatabaseController({skipPresets: true, storageFactory: () => ({storage: fake(async id => {events.push(id); return null;}), close() {}})});
  const dbPath = path.join(tmpdir(), `controller-external-${randomUUID()}.db`);
  const key = process.platform === "win32" ? dbPath.toLowerCase() : dbPath;
  const state = globalThis as typeof globalThis & {projectplanerDatabaseControllers?: Map<string, typeof db>};
  const controllers = state.projectplanerDatabaseControllers ??= new Map();
  controllers.set(key, db);
  const previousPath = process.env.PROJECTPLANER_DB_PATH;
  process.env.PROJECTPLANER_DB_PATH = dbPath;
  try {
    const request = withDb(async controller => {
      await controller.entities.get("before external wait"); entered.resolve();
      await external.promise;
      await controller.entities.get("after external wait");
    });
    await entered.promise;
    await db.entities.get("unrelated request");
    assert.deepEqual(events, ["before external wait", "unrelated request"]);
    external.resolve(); await request;
  } finally {
    external.resolve(); await db.shutdown(); controllers.delete(key);
    if (previousPath === undefined) delete process.env.PROJECTPLANER_DB_PATH;
    else process.env.PROJECTPLANER_DB_PATH = previousPath;
  }
});

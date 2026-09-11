import assert from "node:assert/strict";
import "./agent-runs.node-test";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createDatabase } from "../client";
import { openSqlite } from "../index";
import { createDatabaseController } from "../../../controller";

function fixture(t: {after(fn: () => void): void}) {
  const dir = mkdtempSync(path.join(tmpdir(), "planner-reliability-"));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  return path.join(dir, "test.db");
}

function child(dbPath: string, mode = "create"): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./concurrency-worker.ts", import.meta.url)), dbPath, mode], {windowsHide: true});
    let output = "", error = "";
    worker.stdout.on("data", data => { output += data; });
    worker.stderr.on("data", data => { error += data; });
    worker.on("error", reject);
    worker.on("exit", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
  });
}

async function writer(dbPath: string, duration: number) {
  const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
    const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(workerData.path);
    db.exec('BEGIN IMMEDIATE'); parentPort.postMessage('locked');
    setTimeout(()=>{db.exec('ROLLBACK');db.close();parentPort.close();},workerData.duration);`,
    {eval: true, workerData: {path: dbPath, duration}});
  await new Promise<void>((resolve, reject) => { worker.once("message", () => resolve()); worker.once("error", reject); });
  return worker;
}

test("initialized controller opens remain read-only under another writer, including catalog checks", async t => {
  const dbPath = fixture(t);
  const seed = createDatabaseController({path: dbPath, skipPresets: true});
  await seed.projects.create({key: "PLAN", title: "Plan"}); await seed.shutdown();
  const bootstrap = createDatabaseController({path: dbPath});
  await bootstrap.projects.list(); await bootstrap.shutdown();
  const holder = new DatabaseSync(dbPath);
  const db = createDatabaseController({path: dbPath});
  try {
    holder.exec("BEGIN IMMEDIATE");
    assert.equal((await db.projects.list()).length, 1);
    const inspection = createDatabase(dbPath);
    try {
      assert.equal(inspection.prepare("PRAGMA busy_timeout").get()?.timeout, 1000);
      assert.equal(inspection.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
      assert.equal(inspection.prepare("SELECT total_changes() AS n").get()?.n, 0);
    } finally { inspection.close(); }
  } finally { await db.shutdown(); holder.exec("ROLLBACK"); holder.close(); }
});

test("brief external contention recovers; sustained contention fails within a bound", async t => {
  const dbPath = fixture(t);
  const db = createDatabaseController({path: dbPath, skipPresets: true});
  await db.projects.create({key: "PLAN", title: "Plan"});
  try {
    const short = await writer(dbPath, 120);
    try { await db.entities.create({projectKey: "PLAN", type: "aspect", title: "Waited"}); }
    finally { await short.terminate(); }
    const long = await writer(dbPath, 3000);
    try {
      const start = performance.now();
      await assert.rejects(db.entities.create({projectKey: "PLAN", type: "aspect", title: "Busy"}), /locked|busy/i);
      const elapsed = performance.now() - start;
      assert.ok(elapsed >= 850 && elapsed < 2200, `elapsed ${elapsed}`);
    } finally { await long.terminate(); }
    assert.equal((await db.entities.list({type: "aspect"})).length, 1);
  } finally { await db.shutdown(); }
});

test("independent processes bootstrap safely and allocate distinct feature keys", async t => {
  const dbPath = fixture(t);
  await Promise.all([child(dbPath, "bootstrap"), child(dbPath, "bootstrap")]);
  const db = createDatabaseController({path: dbPath, skipPresets: true});
  await db.projects.create({key: "PLAN", title: "Plan"}); await db.shutdown();
  await Promise.all([child(dbPath, "bootstrap"), child(dbPath, "bootstrap")]);
  const keys = (await Promise.all([child(dbPath), child(dbPath)])).flatMap(out => JSON.parse(out) as string[]);
  assert.equal(keys.length, 12); assert.equal(new Set(keys).size, 12);
});

test("rollup failure rolls back the child mutation and preserves the original error", async t => {
  const dbPath = fixture(t);
  const db = createDatabaseController({path: dbPath, skipPresets: true});
  try {
    await db.projects.create({key: "PLAN", title: "Plan"});
    const parent = await db.entities.create({projectKey: "PLAN", type: "feature", title: "Parent"});
    const child = await db.entities.create({projectKey: "PLAN", type: "task", title: "Child", relations: [{targetEntityId: parent.entity.id, type: "implements", isPrimary: true}]});
    const beforeParent = await db.entities.get(parent.entity.id);
    const secondParent = await db.entities.create({projectKey: "PLAN", type: "feature", title: "Second parent"});
    const trigger = new DatabaseSync(dbPath);
    try { trigger.exec(`CREATE TRIGGER reject_rollup BEFORE UPDATE OF status ON entities WHEN OLD.type = 'feature' BEGIN SELECT RAISE(ABORT, 'injected rollup failure'); END;`); }
    finally { trigger.close(); }
    await assert.rejects(db.entities.update({id: child.entity.id, patch: {status: "done"}}), /injected rollup failure/);
    assert.equal((await db.entities.get(child.entity.id))?.status, "planned");
    assert.equal((await db.entities.get(parent.entity.id))?.status, beforeParent?.status);
    await assert.rejects(db.entities.create({projectKey: "PLAN", type: "task", title: "Done child", status: "done", relations: [{targetEntityId: secondParent.entity.id, type: "implements", isPrimary: true}]}), /injected rollup failure/);
    assert.equal((await db.entities.list({type: "task"})).length, 1);
  } finally { await db.shutdown(); }
});

test("legacy data migrations run once and failed initialization releases its handle", async t => {
  const dbPath = fixture(t);
  let db = createDatabase(dbPath);
  db.exec("INSERT INTO projects(id,key,title) VALUES('p','PLAN','Plan'); INSERT INTO entities(id,project_id,type,slug,title,status) VALUES('a','p','aspect','a','A','doing'); PRAGMA user_version=0");
  db.close(); db = createDatabase(dbPath);
  assert.equal(db.prepare("SELECT status FROM entities WHERE id='a'").get()?.status, "in_progress");
  assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 2);
  db.close(); db = createDatabase(dbPath);
  assert.equal(db.prepare("SELECT total_changes() AS n").get()?.n, 0);
  db.exec("PRAGMA user_version=99"); db.close();
  assert.throws(() => openSqlite(dbPath), /newer/);
  // Windows refuses removal with an open handle; this verifies initialization cleanup.
  rmSync(dbPath);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createDatabase } from "./client";
import projects from "./repositories/projects";
import workspaces from "./repositories/project-workspaces";
import { migrateWorkspaces } from "./migrate-workspaces";
import { provisionProjectWorkspace, readProjectWorkspace } from "../../../apps/web/lib/project-workspace";
import { inspectGit, provisionRepository, repositoryPathFor, runGit, validateSourceUrl, WorkspaceError } from "../../workspace/src/index";
import type { ProjectWorkspace } from "@projectplaner/core";

test("workspace migration preserves existing planning-only projects", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE projects (id TEXT PRIMARY KEY, key TEXT); INSERT INTO projects VALUES ('old', 'OLD')");
    migrateWorkspaces(db); migrateWorkspaces(db);
    assert.equal(db.prepare("SELECT archived_at FROM projects").get()?.archived_at, null);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM project_workspaces").get()?.n, 0);
  } finally { db.close(); }
});

test("managed workspace lifecycle, duplicate ownership, restart, archive and recovery", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "projectplaner-workspaces-"));
  const oldRoot = process.env.PROJECTPLANER_WORKSPACES_ROOT;
  process.env.PROJECTPLANER_WORKSPACES_ROOT = root;
  const dbPath = path.join(root, "test.db");
  let db = createDatabase(dbPath);
  try {
    const { project } = await projects.create(db, { key: "CODE", title: "Code" });
    assert.equal((await readProjectWorkspace(db, "CODE")).workspace, null);
    const results = await Promise.allSettled([
      provisionProjectWorkspace(db, "CODE", { mode: "create" }),
      provisionProjectWorkspace(db, "CODE", { mode: "create" })
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    let state = await readProjectWorkspace(db, "CODE");
    assert.equal(state.workspace?.status, "ready", JSON.stringify(state.error));
    assert.deepEqual(state.git, { branch: "main", head: null, dirty: false, origin: null });
    const location = state.workspace!.repositoryPath;
    db.prepare("UPDATE projects SET title = 'Renamed' WHERE id = ?").run(project.id);
    db.close(); db = createDatabase(dbPath);
    assert.equal((await readProjectWorkspace(db, "CODE")).workspace?.repositoryPath, location);
    await fs.writeFile(path.join(location, "hello.txt"), "hello");
    assert.equal((await readProjectWorkspace(db, "CODE")).git?.dirty, true);
    await projects.setArchived(db, "CODE", true);
    assert.equal((await projects.list(db)).length, 0);
    assert.equal((await projects.list(db, { includeArchived: true }))[0]?.entityCount, 1);
    await assert.rejects(projects.create(db, { key: "CODE", title: "Duplicate" }), /already exists/);
    await assert.rejects(projects.remove(db, "CODE"), /archived/);
    await assert.rejects(provisionProjectWorkspace(db, "CODE", { mode: "create" }), { code: "archived" });
    await projects.setArchived(db, "CODE", false);
    assert.equal(await fs.readFile(path.join(location, "hello.txt"), "utf8"), "hello");
    await projects.create(db, { key: "PLAN", title: "Plan" });
    await assert.rejects(projects.setArchived(db, "PLAN", true), /protected/i);
    await assert.rejects(projects.remove(db, "PLAN"), /protected/i);

    // An interrupted DB update after finalization is recovered using its attempt marker.
    db.prepare("UPDATE project_workspaces SET status = 'provisioning' WHERE project_id = ?").run(project.id);
    assert.equal((await readProjectWorkspace(db, "CODE")).workspace?.status, "ready");
    const { project: second } = await projects.create(db, { key: "RETRY", title: "Retry" });
    const interrupted: ProjectWorkspace = { ...state.workspace!, id: "workspace_" + randomUUID(), projectId: second.id,
      attemptId: randomUUID(), status: "provisioning" };
    interrupted.repositoryPath = repositoryPathFor(interrupted.id);
    assert.equal(workspaces.reserve(db, interrupted, false), true);
    state = await readProjectWorkspace(db, "RETRY");
    assert.equal(state.error?.code, "interrupted");
    state = await provisionProjectWorkspace(db, "RETRY", null, true);
    assert.equal(state.workspace?.status, "ready");
    assert.notEqual(state.workspace?.attemptId, interrupted.attemptId);
    assert.equal(state.workspace?.repositoryPath, interrupted.repositoryPath);
    await projects.create(db, { key: "BADIMPORT", title: "Failed import" });
    const failure = await provisionProjectWorkspace(db, "BADIMPORT", { mode: "import", sourceUrl: "https://127.0.0.1:1/unreachable.git" });
    assert.equal(failure.workspace?.status, "failed");
    assert.equal(failure.error?.code, "git_failed");
    const retried = await provisionProjectWorkspace(db, "BADIMPORT", null, true);
    assert.equal(retried.workspace?.status, "failed");
    assert.notEqual(retried.workspace?.attemptId, failure.workspace?.attemptId);
    assert.equal(retried.workspace?.repositoryPath, failure.workspace?.repositoryPath);
    await projects.setArchived(db, "BADIMPORT", true);
    await assert.rejects(provisionProjectWorkspace(db, "BADIMPORT", null, true), { code: "archived" });
    await fs.rename(path.join(location, ".git"), path.join(location, "removed-git"));
    assert.equal((await readProjectWorkspace(db, "CODE")).error?.code, "unavailable");
    await assert.rejects(provisionProjectWorkspace(db, "CODE", { mode: "create" }), { code: "conflict" });
  } finally {
    db.close();
    if (oldRoot === undefined) delete process.env.PROJECTPLANER_WORKSPACES_ROOT;
    else process.env.PROJECTPLANER_WORKSPACES_ROOT = oldRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("import keeps remote default branch/history; failed attempts never replace the destination", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "projectplaner-import-"));
  try {
    const source = path.join(root, "source"); await fs.mkdir(source);
    await runGit(["init", "--initial-branch=trunk"], source);
    await fs.writeFile(path.join(source, "file.txt"), "one");
    await runGit(["add", "file.txt"], source);
    await runGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "Initial"], source);
    const workspace: ProjectWorkspace = { id: "workspace_import", projectId: "test", repositoryPath: repositoryPathFor("workspace_import", root),
      mode: "import", sourceUrl: "https://example.invalid/repo.git", status: "provisioning", attemptId: "first", ownerPid: process.pid,
      deadlineAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastError: null };
    // Substitute only the transport URL; all clone, validation and finalization operations use real Git.
    await provisionRepository(workspace, (args, cwd, options) => runGit(args[0] === "clone" ? ["clone", "--", source, args[3]!] : args, cwd, options));
    const state = await inspectGit(workspace.repositoryPath);
    assert.equal(state.branch, "trunk"); assert.ok(state.head); assert.equal(state.dirty, false);
    await assert.rejects(provisionRepository({ ...workspace, attemptId: "second" }), { code: "conflict" });
    assert.equal(await fs.readFile(path.join(workspace.repositoryPath, "file.txt"), "utf8"), "one");
    for (const code of ["authentication", "timeout", "git_missing"] as const) {
      const failed = { ...workspace, id: `workspace_${code}`, attemptId: code, repositoryPath: repositoryPathFor(`workspace_${code}`, root) };
      await assert.rejects(provisionRepository(failed, async () => { throw new WorkspaceError(code, "Safe failure"); }), { code });
      assert.deepEqual(await fs.readdir(path.dirname(failed.repositoryPath)), ["workspace.json"]);
    }
    for (const url of ["file:///repo", "https://user:secret@example.com/repo", "https://token@example.com/repo", "ssh://git:secret@example.com/repo", "-x", "https://example.com/repo?token=secret"]) {
      assert.throws(() => validateSourceUrl(url), { code: "invalid_input" });
    }
    assert.equal(validateSourceUrl("git@example.com:team/repo.git"), "git@example.com:team/repo.git");
    await fs.mkdir(path.join(source, "nested"));
    await assert.rejects(inspectGit(path.join(source, "nested")), { code: "unavailable" });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

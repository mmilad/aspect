import { randomUUID } from "node:crypto";
import type { DatabaseController } from "@projectplaner/db";
import type { ProjectWorkspace, WorkspaceView } from "@projectplaner/core";

import {
  GIT_TIMEOUT_MS, WorkspaceError, finalizedByAttempt, inspectGit, openRepositoryFolder,
  parseWorkspaceInput, provisionRepository, repositoryPathFor, workspaceFailure
} from "@projectplaner/workspace";

// Shared across Next route modules and development reloads in this process.
const processState = globalThis as typeof globalThis & { projectplanerWorkspaceAttempts?: Set<string> };
const activeAttempts = processState.projectplanerWorkspaceAttempts ??= new Set<string>();

async function project(db: DatabaseController, key: string) {
 const row = await db.projects.findByKey(key);
 if (!row) throw new WorkspaceError("not_found", "Project not found.");
 return row;
}

function ownerAlive(workspace: ProjectWorkspace): boolean {
  if (workspace.ownerPid === process.pid) return activeAttempts.has(workspace.attemptId);
  try { process.kill(workspace.ownerPid, 0); return true; } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function readProjectWorkspace(db: DatabaseController, key: string): Promise<WorkspaceView> {
  const found = (await project(db, key));
  let workspace = (await db.workspaces.get(found.id));
  if (workspace?.status === "provisioning" && (!ownerAlive(workspace) || Date.parse(workspace.deadlineAt) < Date.now())) {
    if (await finalizedByAttempt(workspace)) {
      try {
        await inspectGit(workspace.repositoryPath);
        (await db.workspaces.finish(workspace, null));
      } catch (error) { (await db.workspaces.finish(workspace, workspaceFailure(error))); }
    } else {
      (await db.workspaces.finish(workspace, { code: "interrupted", message: "Repository setup was interrupted. Retry to start a new attempt." }));
    }
    workspace = (await db.workspaces.get(found.id));
  }
  if (!workspace || workspace.status !== "ready") {
    return { workspace, archivedAt: found.archivedAt, git: null, error: workspace?.lastError ?? null };
  }
  try {
    return { workspace, archivedAt: found.archivedAt, git: await inspectGit(workspace.repositoryPath), error: null };
  } catch (error) {
    return { workspace, archivedAt: found.archivedAt, git: null, error: workspaceFailure(error) };
  }
}

export async function provisionProjectWorkspace(db: DatabaseController, key: string, raw: unknown, retry = false): Promise<WorkspaceView> {
  const state = await readProjectWorkspace(db, key);
  const found = (await project(db, key));
  if (found.archivedAt) throw new WorkspaceError("archived", "Restore this Project before creating its workspace.");
  if (retry ? state.workspace?.status !== "failed" : Boolean(state.workspace)) {
    throw new WorkspaceError("conflict", retry ? "Only failed setup attempts can be retried." : "This Project already has a workspace.");
  }
  const input = retry && state.workspace
    ? { mode: state.workspace.mode, sourceUrl: state.workspace.sourceUrl }
    : parseWorkspaceInput(raw);
  const id = state.workspace?.id ?? `workspace_${randomUUID()}`;
  const now = new Date().toISOString();
  const workspace: ProjectWorkspace = {
    id, projectId: found.id, repositoryPath: state.workspace?.repositoryPath ?? repositoryPathFor(id),
    mode: input.mode, sourceUrl: "sourceUrl" in input ? input.sourceUrl ?? null : null,
    status: "provisioning", attemptId: randomUUID(), ownerPid: process.pid,
    deadlineAt: new Date(Date.now() + GIT_TIMEOUT_MS + 90000).toISOString(),
    createdAt: state.workspace?.createdAt ?? now, updatedAt: now, lastError: null
  };
  activeAttempts.add(workspace.attemptId);
  try {
    if (!(await db.workspaces.reserve(workspace, retry))) throw new WorkspaceError("conflict", "Workspace setup is already in progress, or the Project was archived.");
    try {
      await provisionRepository(workspace);
      (await db.workspaces.finish(workspace, null));
    } catch (error) { (await db.workspaces.finish(workspace, workspaceFailure(error))); }
  } finally { activeAttempts.delete(workspace.attemptId); }
  return readProjectWorkspace(db, key);
}

export async function revealProjectWorkspace(db: DatabaseController, key: string): Promise<void> {
  const state = await readProjectWorkspace(db, key);
  if (!state.workspace || !state.git) throw new WorkspaceError("unavailable", "The workspace repository is not available.");
  await openRepositoryFolder(state.workspace.repositoryPath);
}

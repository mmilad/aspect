import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ProjectWorkspace } from "@projectplaner/core";
import { WorkspaceError } from "./errors";
import { inspectGit, runGit, validateSourceUrl, type GitRunner } from "./git";

// Storage is runtime user data, never a build-time file-tracing dependency.
function runtimeEnvironment(name: string): string | undefined {
  return Reflect.get(process.env, name) as string | undefined;
}

function runtimeHomeDirectory(): string {
  return os.homedir();
}

export function workspaceRoot(): string {
  const override = runtimeEnvironment("PROJECTPLANER_WORKSPACES_ROOT");
  if (override) {
    if (!path.isAbsolute(override)) throw new WorkspaceError("invalid_input", "PROJECTPLANER_WORKSPACES_ROOT must be an absolute path.");
    return path.resolve(override);
  }
  const data = process.platform === "win32" ? runtimeEnvironment("LOCALAPPDATA") ?? path.join(runtimeHomeDirectory(), "AppData", "Local")
    : process.platform === "darwin" ? path.join(runtimeHomeDirectory(), "Library", "Application Support")
    : runtimeEnvironment("XDG_DATA_HOME") ?? path.join(runtimeHomeDirectory(), ".local", "share");
  return path.join(data, "Projectplaner", "workspaces");
}

export function repositoryPathFor(id: string, root = workspaceRoot()): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new WorkspaceError("invalid_input", "Invalid workspace ID.");
  return path.join(path.resolve(root), id, "repo");
}

async function exists(file: string): Promise<boolean> {
  try { await fs.lstat(file); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function assertNotAppCheckout(root: string) {
  let current = process.cwd();
  while (true) {
    if (await exists(path.join(current, "pnpm-workspace.yaml"))) {
      const realApp = await fs.realpath(current);
      const relative = path.relative(realApp, root);
      if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) {
        throw new WorkspaceError("invalid_input", "Managed workspaces must be outside the Projectplaner checkout.");
      }
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function ownedContainer(workspace: ProjectWorkspace) {
  const container = path.dirname(workspace.repositoryPath);
  if (path.basename(container) !== workspace.id || path.basename(workspace.repositoryPath) !== "repo") {
    throw new WorkspaceError("inaccessible", "The workspace location does not match its ownership record.");
  }
  const root = path.dirname(container);
  await assertNotAppCheckout(root);
  await fs.mkdir(root, { recursive: true });
  await assertNotAppCheckout(await fs.realpath(root));
  const marker = path.join(container, "workspace.json");
  try {
    await fs.mkdir(container);
    await fs.writeFile(marker, JSON.stringify({ workspaceId: workspace.id }), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if ((await fs.lstat(container)).isSymbolicLink()) throw new WorkspaceError("inaccessible", "The managed workspace directory cannot be a symbolic link.");
  const owner = JSON.parse(await fs.readFile(marker, "utf8"));
  if (owner.workspaceId !== workspace.id) throw new WorkspaceError("conflict", "The directory belongs to another workspace.");
  return container;
}

export async function finalizedByAttempt(workspace: ProjectWorkspace): Promise<boolean> {
  try {
    if ((await fs.lstat(workspace.repositoryPath)).isSymbolicLink()) return false;
    const marker = JSON.parse(await fs.readFile(path.join(workspace.repositoryPath, ".git", "projectplaner-owner.json"), "utf8"));
    return marker.workspaceId === workspace.id && marker.attemptId === workspace.attemptId;
  } catch { return false; }
}

export async function provisionRepository(workspace: ProjectWorkspace, git: GitRunner = runGit): Promise<void> {
  const container = await ownedContainer(workspace);
  if (await exists(workspace.repositoryPath)) throw new WorkspaceError("conflict", "The repository destination already exists. It will not be overwritten.");
  if (!/^[a-zA-Z0-9_-]+$/.test(workspace.attemptId)) throw new WorkspaceError("invalid_input", "Invalid attempt ID.");
  const attempt = path.join(container, `attempt-${workspace.attemptId}`);
  const staging = path.join(attempt, "repo");
  await fs.mkdir(attempt); // Exclusive: never reuse another attempt's directory.
  try {
    if (workspace.mode === "import") {
      const url = validateSourceUrl(workspace.sourceUrl ?? "");
      await git(["clone", "--", url, staging], attempt);
    } else {
      await fs.mkdir(staging);
      await git(["init", "--initial-branch=main"], staging);
    }
    await inspectGit(staging, git);
    await fs.writeFile(path.join(staging, ".git", "projectplaner-owner.json"), JSON.stringify({ workspaceId: workspace.id, attemptId: workspace.attemptId }), { flag: "wx" });
    if (await exists(workspace.repositoryPath)) throw new WorkspaceError("conflict", "The repository destination already exists. It will not be overwritten.");
    await fs.rename(staging, workspace.repositoryPath);
  } finally {
    // This invocation created the exact attempt path above. Never delete the final repo.
    if (path.dirname(attempt) === container && !(await fs.lstat(attempt).catch(() => null))?.isSymbolicLink()) {
      await fs.rm(attempt, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export async function openRepositoryFolder(repositoryPath: string): Promise<void> {
  await inspectGit(repositoryPath);
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [repositoryPath], { shell: false, windowsHide: true, detached: true, stdio: "ignore" });
    child.once("error", () => reject(new WorkspaceError("inaccessible", "Could not open the folder on the Projectplaner host.")));
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

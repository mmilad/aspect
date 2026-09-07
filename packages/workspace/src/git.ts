import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { CreateWorkspaceInput, WorkspaceGitState } from "@projectplaner/core";
import { WorkspaceError } from "./errors";

export const GIT_TIMEOUT_MS = 5 * 60 * 1000;

export function parseWorkspaceInput(raw: unknown): CreateWorkspaceInput {
  if (!raw || typeof raw !== "object") throw new WorkspaceError("invalid_input", "Choose create or import.");
  const input = raw as Record<string, unknown>;
  if (input.mode === "create") return { mode: "create" };
  if (input.mode !== "import" || typeof input.sourceUrl !== "string") {
    throw new WorkspaceError("invalid_input", "An HTTPS or SSH repository URL is required.");
  }
  return { mode: "import", sourceUrl: validateSourceUrl(input.sourceUrl) };
}

export function validateSourceUrl(raw: string): string {
  const value = raw.trim();
  const invalid = () => new WorkspaceError("invalid_input", "Use an HTTPS or SSH repository URL without embedded credentials, query parameters, or fragments.");
  if (!value || /[\s\x00-\x1f]/.test(value) || value.startsWith("-")) throw invalid();
  if (/^[\w.-]+@[\w.-]+:[^/].+$/.test(value)) {
    if (/[?#]/.test(value)) throw invalid();
    return value;
  }
  let url: URL;
  try { url = new URL(value); } catch { throw invalid(); }
  if (!["https:", "ssh:"].includes(url.protocol) || !url.hostname || url.pathname === "/" ||
      url.password || url.search || url.hash || (url.protocol === "https:" && url.username)) throw invalid();
  return value;
}

export function sanitizeRemote(raw: string): string | null {
  try { return validateSourceUrl(raw); } catch { return raw.trim() ? "Configured remote (URL hidden)" : null; }
}

export type GitResult = { code: number; stdout: string };
export type GitRunner = (args: string[], cwd: string, options?: { allowFailure?: boolean; timeoutMs?: number }) => Promise<GitResult>;

/** Never return stderr: credential helpers and remotes may include secrets in diagnostics. */
export const runGit: GitRunner = (args, cwd, options = {}) => new Promise((resolve, reject) => {
  const child = spawn("git", ["-c", `safe.directory=${cwd.replaceAll("\\", "/")}`, ...args], {
    cwd, shell: false, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never", GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes", GIT_OPTIONAL_LOCKS: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === "win32" && child.pid) {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.on("error", () => child.kill("SIGKILL"));
    } else child.kill("SIGKILL");
  }, options.timeoutMs ?? GIT_TIMEOUT_MS);
  child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < 1024 * 1024) stdout += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < 64 * 1024) stderr += chunk.toString(); });
  child.on("error", (error: NodeJS.ErrnoException) => {
    clearTimeout(timer);
    reject(new WorkspaceError(error.code === "ENOENT" ? "git_missing" : "inaccessible",
      error.code === "ENOENT" ? "Git is not installed or is not on PATH." : "Git could not start in the workspace directory."));
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (timedOut) return reject(new WorkspaceError("timeout", "Git timed out after the allowed operation duration. Retry when the repository is reachable."));
    if (code !== 0 && !options.allowFailure) {
      const auth = /authentication|permission denied|could not read Username|terminal prompts disabled|host key verification|repository not found/i.test(stderr);
      return reject(new WorkspaceError(auth ? "authentication" : "git_failed", auth
        ? "Git could not authenticate or access this repository. Configure Git credentials and SSH host trust on this machine, then retry."
        : "Git could not complete the operation. Check the repository URL and connectivity, then retry."));
    }
    resolve({ code: code ?? 1, stdout: stdout.trim() });
  });
});

export async function inspectGit(repositoryPath: string, git: GitRunner = runGit): Promise<WorkspaceGitState> {
  try {
    const stat = await fs.lstat(repositoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
    if (!(await fs.lstat(path.join(repositoryPath, ".git"))).isDirectory()) throw new Error();
  } catch { throw new WorkspaceError("unavailable", "The stored workspace is missing or is not a Git working copy."); }
  const inside = await git(["rev-parse", "--show-toplevel"], repositoryPath, { allowFailure: true, timeoutMs: 15000 });
  if (inside.code !== 0 || path.relative(await fs.realpath(repositoryPath), path.resolve(inside.stdout)) !== "") throw new WorkspaceError("unavailable", "The stored workspace is missing or is not a Git working copy.");
  const branch = await git(["symbolic-ref", "--quiet", "--short", "HEAD"], repositoryPath, { allowFailure: true, timeoutMs: 15000 });
  const head = await git(["rev-parse", "--verify", "HEAD"], repositoryPath, { allowFailure: true, timeoutMs: 15000 });
  const status = await git(["status", "--porcelain", "--untracked-files=normal"], repositoryPath, { timeoutMs: 15000 });
  const origin = await git(["remote", "get-url", "origin"], repositoryPath, { allowFailure: true, timeoutMs: 15000 });
  return { branch: branch.code === 0 ? branch.stdout : null, head: head.code === 0 ? head.stdout : null, dirty: Boolean(status.stdout), origin: origin.code === 0 ? sanitizeRemote(origin.stdout) : null };
}

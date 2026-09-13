import fs from "node:fs/promises";
import path from "node:path";
import type {
  WorkflowFileEntry,
  WorkflowFileListInput,
  WorkflowFileListResult,
  WorkflowFileReadInput,
  WorkflowFileReadResult
} from "@projectplaner/core";
import { WorkspaceError } from "./errors";

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES = 1_000_000;

function relativePath(root: string, target: string): string {
  const value = path.relative(root, target).split(path.sep).join("/");
  return value || ".";
}

async function realRoot(root: string): Promise<string> {
  try {
    const stat = await fs.stat(root);
    if (!stat.isDirectory()) throw new WorkspaceError("inaccessible", "The workspace repository is not a directory.");
    return await fs.realpath(root);
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError("inaccessible", "The managed workspace repository is unavailable.");
  }
}

async function resolveExisting(root: string, requested: string): Promise<{ root: string; target: string }> {
  if (requested.includes("\0") || path.isAbsolute(requested)) {
    throw new WorkspaceError("invalid_input", "File paths must be relative to the managed workspace.");
  }
  const safeRoot = await realRoot(root);
  const target = path.resolve(safeRoot, requested || ".");
  const lexical = path.relative(safeRoot, target);
  if (lexical === ".." || lexical.startsWith(`..${path.sep}`) || path.isAbsolute(lexical)) {
    throw new WorkspaceError("invalid_input", "File path escapes the managed workspace.");
  }
  let realTarget: string;
  try {
    realTarget = await fs.realpath(target);
  } catch {
    throw new WorkspaceError("not_found", `Workspace path '${requested || "."}' was not found.`);
  }
  const realRelative = path.relative(safeRoot, realTarget);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    throw new WorkspaceError("invalid_input", "File path escapes the managed workspace.");
  }
  return { root: safeRoot, target: realTarget };
}

function boundedMax(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new WorkspaceError("invalid_input", `The requested limit must be an integer between 1 and ${maximum}.`);
  }
  return value as number;
}

export async function listWorkspaceFiles(root: string, input: WorkflowFileListInput = {}): Promise<WorkflowFileListResult> {
  const resolved = await resolveExisting(root, input.path ?? ".");
  const stat = await fs.stat(resolved.target);
  if (!stat.isDirectory()) throw new WorkspaceError("invalid_input", "File listing requires a directory path.");
  const maxEntries = boundedMax(input.maxEntries, DEFAULT_MAX_ENTRIES, 10_000);
  const entries: WorkflowFileEntry[] = [];
  const visit = async (directory: string): Promise<void> => {
    const children = await fs.readdir(directory, { withFileTypes: true });
    for (const child of children) {
      if (entries.length >= maxEntries) return;
      if (child.isSymbolicLink()) continue;
      const childPath = path.join(directory, child.name);
      if (child.isDirectory()) {
        entries.push({ path: relativePath(resolved.root, childPath), kind: "directory" });
        if (input.recursive) await visit(childPath);
      } else if (child.isFile()) {
        const childStat = await fs.lstat(childPath);
        entries.push({ path: relativePath(resolved.root, childPath), kind: "file", bytes: childStat.size });
      }
    }
  };
  await visit(resolved.target);
  return { entries };
}

export async function readWorkspaceFile(root: string, input: WorkflowFileReadInput): Promise<WorkflowFileReadResult> {
  const resolved = await resolveExisting(root, input.path);
  const stat = await fs.stat(resolved.target);
  if (!stat.isFile()) throw new WorkspaceError("invalid_input", "File reading requires a regular file.");
  const maxBytes = boundedMax(input.maxBytes, DEFAULT_MAX_BYTES, 10_000_000);
  const content = await fs.readFile(resolved.target, { encoding: "utf8" });
  const raw = Buffer.from(content, "utf8");
  const truncated = raw.byteLength > maxBytes;
  const output = truncated ? raw.subarray(0, maxBytes).toString("utf8") : content;
  return {
    path: relativePath(resolved.root, resolved.target),
    content: output,
    bytes: Buffer.byteLength(output, "utf8"),
    truncated,
    encoding: "utf8"
  };
}

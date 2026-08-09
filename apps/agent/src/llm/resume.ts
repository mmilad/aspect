import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowClient } from "../client/workflow-client";
import type { WorkflowRunResponse } from "../client/types";
import { FixtureLlmAdapter, type FixtureEntry } from "./fixture-adapter";
import type { LlmAdapter } from "./types";
import { isPendingLlm } from "../client/pending-llm";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function defaultFixturesDir(): string {
  return path.join(packageRoot, "fixtures");
}

export async function loadFixtureFile(filePath: string): Promise<FixtureEntry[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture file must be a JSON array: ${filePath}`);
  }
  return parsed as FixtureEntry[];
}

export async function loadFixtureAdapter(dir = defaultFixturesDir()): Promise<FixtureLlmAdapter> {
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(dir);
  const entries: FixtureEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    entries.push(...(await loadFixtureFile(path.join(dir, name))));
  }
  return new FixtureLlmAdapter({ fixtures: entries });
}

/** If response is pending_llm, complete via adapter and resume once. */
export async function resumePendingWithAdapter(options: {
  client: WorkflowClient;
  adapter: LlmAdapter;
  response: WorkflowRunResponse;
  workflowKey?: string;
}): Promise<WorkflowRunResponse> {
  const { client, adapter, response, workflowKey } = options;
  if (!isPendingLlm(response)) {
    return response;
  }
  const pending = client.pendingLlm(response);
  if (!pending) {
    throw new Error("pending_llm response missing surface.");
  }
  const llmWrites = await adapter.complete({ pending, workflowKey });
  return client.resume({ runId: pending.runId, llmWrites });
}

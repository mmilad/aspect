import { spawn } from "node:child_process";
import { CallableLlmAdapter } from "./callable-adapter";
import type { LlmAdapter } from "./types";

/**
 * Optional live/small-model path: run an external command with the adapter prompt on stdin;
 * stdout must be JSON (or fenced JSON) for llmWrites.
 *
 * Example:
 *   PROJECTPLANER_LLM_HOOK="node ./scripts/echo-writes.js"
 */
export function createHookLlmAdapter(command: string): LlmAdapter {
  return new CallableLlmAdapter({
    completeText: async (prompt) => runHook(command, prompt)
  });
}

function runHook(command: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`LLM hook exited ${code}: ${stderr.trim() || stdout.trim() || "no output"}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

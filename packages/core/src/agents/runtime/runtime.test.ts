import { expect, it, vi } from "vitest";
import { DefaultAgentRuntime } from "./runtime";
import { parseAgentProfile } from "../profile";
import type { AgentExecutionAdapters, AgentRun } from "../types";

function fixture(runLlm?: AgentExecutionAdapters["runLlm"]) {
  let saved: AgentRun | null = null;
  const events: string[] = [];
  const runtime = new DefaultAgentRuntime(
    { get: async () => parseAgentProfile({}), saveHistory: async () => undefined },
    { get: async () => saved && structuredClone(saved), save: async run => { saved = structuredClone(run); } },
    { getContext: async () => ({ sources: [], text: "", truncated: false }) },
    { runLlm, runWorkflow: vi.fn(), runCapability: vi.fn() },
    { emit: async event => {
      if (event.type === "run_completed") expect(saved?.status).toBe("completed");
      events.push(event.type);
    } }
  );
  return { runtime, events, saved: () => saved };
}
const input = { agentId: "a", task: "task", projectKey: "PLAN" };

it("does not replace a committed response when a non-atomic adapter's terminal event fails", async () => {
  let saved: AgentRun | null = null;
  const runtime = new DefaultAgentRuntime(
    { get: async () => parseAgentProfile({}), saveHistory: async () => undefined },
    { get: async () => saved, save: async run => { saved = structuredClone(run); } },
    { getContext: async () => ({ sources: [], text: "", truncated: false }) },
    { runLlm: async () => ({ type: "complete", result: "answer" }), runWorkflow: vi.fn(), runCapability: vi.fn() },
    { emit: async event => { if (event.type === "run_completed") throw new Error("event write failed"); } }
  );
  const result = await runtime.start(input);
  expect(result.status).toBe("completed");
  expect(result.result).toBe("answer");
});

it("persists completion before its terminal event and does not rerun terminal runs", async () => {
  const llm = vi.fn().mockResolvedValue({ type: "complete", result: "answer" });
  const f = fixture(llm);
  const run = await f.runtime.start(input);
  expect(run.result).toBe("answer");
  expect(f.events).toEqual(["run_started", "context_loading", "context_loaded", "llm_started", "llm_completed", "run_completed"]);
  await f.runtime.resume({ runId: run.id });
  expect(llm).toHaveBeenCalledTimes(1);
});

it.each([undefined, async () => { throw new Error("private provider response"); },
  async () => ({ type: "complete" as const, result: undefined })])("persists failure with a terminal event", async llm => {
  const f = fixture(llm);
  const run = await f.runtime.start(input);
  expect(run.status).toBe("failed");
  expect(f.events.at(-1)).toBe("run_failed");
  expect(JSON.stringify(f.saved())).not.toContain("private provider response");
});

it("does not overwrite cancellation when a model returns later", async () => {
  let finish!: (value: { type: "complete"; result: string }) => void;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.runtime.start(input);
  await vi.waitFor(() => expect(finish).toBeDefined());
  await f.runtime.cancel(f.saved()!.id);
  finish({ type: "complete", result: "late" });
  expect((await pending).status).toBe("canceled");
  expect(f.events.at(-1)).toBe("run_canceled");
});

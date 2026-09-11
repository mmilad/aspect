import { afterEach, describe, expect, it, vi } from "vitest";
import { readAgentRun, submitTurn } from "../apps/web/components/assistant/turn-client";
import { replayCursor, replayResponse } from "../apps/web/lib/agent-event-replay";
import { parseAgentCompletion } from "../packages/core/src/agents/runtime/completion";

afterEach(() => vi.unstubAllGlobals());
const input = { agentId: null, projectKey: "PLAN", sessionId: "session", message: "hello" };

describe("Assistant and agent transport", () => {
  it("keeps the full normal session and uses the normal endpoint", async () => {
    const session = { id: "session", session: { messages: [{ content: "old" }, { content: "new" }] } };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ session }));
    vi.stubGlobal("fetch", fetcher);
    expect(await submitTurn(input)).toEqual({ session });
    expect(fetcher.mock.calls[0][0]).toBe("/api/assistant/turn");
  });
  it("maps persisted id and preserves failed runs without a chat session", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "run", status: "failed", error: "failed" }, { status: 502 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await submitTurn({ ...input, agentId: "agent" })).toEqual({ agent: {
      runId: "run", status: "failed", error: "failed", result: undefined, events: [],
      agentId: undefined, task: undefined, startedAt: undefined
    } });
    expect(fetcher.mock.calls[0][0]).toBe("/api/agents/run");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty("sessionId");
  });
  it("rejects missing IDs and visibly handles missing results", () => {
    expect(() => readAgentRun({ status: "completed" })).toThrow(/run ID/);
    expect(readAgentRun({ id: "run", status: "completed" }).error).toMatch(/without a result/);
    expect(readAgentRun({ id: "run", status: "completed", result: "answer" }).result).toBe("answer");
  });
  it("restores persisted prompts and responses without a normal Assistant session", () => {
    const saved = JSON.parse(JSON.stringify({
      id: "run", agentId: "coding", task: "Can you code?", result: "I can explain code.",
      status: "completed", startedAt: "2026-09-11"
    }));
    expect(readAgentRun(saved)).toMatchObject({
      runId: "run", agentId: "coding", task: "Can you code?", result: "I can explain code."
    });
  });
  it("rejects missing normal session payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(submitTurn(input)).rejects.toThrow(/session/);
  });
});

describe("finite SSE replay", () => {
  it.each(["run_completed", "run_failed", "run_canceled"] as const)("closes replay for %s", async type => {
    const response = replayResponse([{ id: "event", runId: "run", type, message: "status", createdAt: "now" }]);
    expect(await response.text()).toContain(`event: ${type}\n`);
    expect(await replayResponse([]).text()).toBe("");
  });
  it("supports Last-Event-ID and explicit after precedence", () => {
    expect(replayCursor(new Request("http://local/events", { headers: { "Last-Event-ID": "a" } }))).toBe("a");
    expect(replayCursor(new Request("http://local/events?after=b", { headers: { "Last-Event-ID": "a" } }))).toBe("b");
  });
});

it("only accepts final answers and drops extra reasoning fields", () => {
  expect(parseAgentCompletion('{"type":"complete","result":"answer","reasoning":"private","summary":"private"}'))
    .toEqual({ type: "complete", result: "answer" });
  expect(() => parseAgentCompletion('{"type":"complete","result":""}')).toThrow();
  expect(() => parseAgentCompletion('{"type":"complete","result":"<think>private</think>"}')).toThrow();
});

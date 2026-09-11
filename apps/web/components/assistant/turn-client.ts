import type { AgentRun, AgentRunEvent } from "@projectplaner/core";
import type { AssistantSessionRecord } from "@projectplaner/core/assistant";

export type AgentMessage = {
  runId: string;
  agentId?: string;
  task?: string;
  startedAt?: string;
  status: AgentRun["status"];
  result?: unknown;
  error?: string;
  events: AgentRunEvent[];
  eventsError?: string;
};

export function readAgentRun(payload: unknown): AgentMessage {
  const run = payload as Partial<AgentRun> | null;
  if (!run || typeof run.id !== "string" || !run.id ||
      !["queued", "running", "waiting", "completed", "failed", "canceled"].includes(run.status ?? "")) {
    throw new Error("Agent response did not include a valid run ID and status.");
  }
  return {
    runId: run.id, status: run.status!, result: run.result, events: [],
    agentId: run.agentId, task: run.task, startedAt: run.startedAt,
    error: run.error ?? (run.status === "completed" &&
      (run.result == null || run.result === "") ? "Agent completed without a result." : undefined)
  };
}

export async function submitTurn(input: {
  agentId: string | null; projectKey: string; sessionId?: string; message: string; patch?: unknown;
}): Promise<{ agent: AgentMessage } | { session: AssistantSessionRecord }> {
  const response = await fetch(input.agentId ? "/api/agents/run" : "/api/assistant/turn", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(input.agentId
      ? { agentId: input.agentId, projectKey: input.projectKey, message: input.message }
      : { sessionId: input.sessionId, message: input.message, patch: input.patch })
  });
  const payload = await response.json();
  // Failed persisted runs are still messages, even when POST returns 502.
  if (input.agentId && payload?.id) return { agent: readAgentRun(payload) };
  if (!response.ok) throw new Error(payload?.error ?? "Turn failed.");
  if (input.agentId) return { agent: readAgentRun(payload) };
  if (!payload?.session?.session || !Array.isArray(payload.session.session.messages)) {
    throw new Error("Assistant response did not include a session.");
  }
  return { session: payload.session };
}

import type { AgentRun } from "../types";
import type { AgentRunEvent } from "./events";

export function isTerminal(status: AgentRun["status"]) {
  return status === "completed" || status === "failed" || status === "canceled";
}

export function terminalEvent(run: AgentRun): AgentRunEvent {
  if (!isTerminal(run.status)) throw new Error("Expected terminal agent status.");
  const type = run.status === "completed" ? "run_completed"
    : run.status === "failed" ? "run_failed" : "run_canceled";
  const message = run.status === "completed" ? "Agent response completed."
    : run.status === "failed" ? "Agent execution failed." : "Agent run canceled.";
  return { id: crypto.randomUUID(), runId: run.id, type, message,
    createdAt: run.finishedAt ?? new Date().toISOString() };
}

import type { AgentRun } from "./types";

/** Recent completed exchanges only; operational events never become model messages. */
export function agentConversation(runs: AgentRun[], agentId: string, projectKey: string) {
  return runs
    .filter(run => run.agentId === agentId && run.projectKey === projectKey &&
      run.status === "completed" && typeof run.result === "string")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))
    .slice(-10)
    .flatMap(run => [
      { role: "user" as const, content: run.task.slice(0, 6000) },
      { role: "assistant" as const, content: (run.result as string).slice(0, 6000) }
    ]);
}

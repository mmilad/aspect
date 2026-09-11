import { expect, it } from "vitest";
import { agentConversation } from "./conversation";
import type { AgentRun } from "./types";

const run = (id: string, patch: Partial<AgentRun> = {}): AgentRun => ({
  id, agentId: "agent", projectKey: "PLAN", task: `question ${id}`,
  result: `answer ${id}`, status: "completed", startedAt: id,
  stepCount: 1, workflowCallCount: 0, ...patch
});

it("restores chronological exchanges without leaking other projects, agents or failures", () => {
  expect(agentConversation([
    run("02"), run("01"), run("03", { agentId: "other" }),
    run("04", { projectKey: "OTHER" }), run("05", { status: "failed" })
  ], "agent", "PLAN")).toEqual([
    { role: "user", content: "question 01" }, { role: "assistant", content: "answer 01" },
    { role: "user", content: "question 02" }, { role: "assistant", content: "answer 02" }
  ]);
});

it("bounds context without truncating saved history", () => {
  const runs = Array.from({ length: 15 }, (_, n) => run(String(n).padStart(2, "0"), { task: "x".repeat(7000) }));
  const messages = agentConversation(runs, "agent", "PLAN");
  expect(messages).toHaveLength(20);
  expect(messages[0].content).toHaveLength(6000);
  expect(runs[0].task).toHaveLength(7000);
});

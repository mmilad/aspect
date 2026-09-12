import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

function delegateGraph() {
  return parseWorkflowGraph({
    version: 4,
    variables: [
      { name: "projectKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
      { name: "agentId", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
      { name: "task", role: "input", shape: { kind: "primitive", type: "string" }, required: true }
    ],
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      { id: "delegate", type: "delegate", position: { x: 100, y: 0 }, data: { title: "Delegate" } },
      { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      { id: "next_a", source: "start", target: "delegate", kind: "next" },
      { id: "next_b", source: "delegate", target: "end", kind: "next" },
      { id: "agent", source: "start", target: "delegate", kind: "data", sourcePin: "agentId", targetPin: "agentId" },
      { id: "task", source: "start", target: "delegate", kind: "data", sourcePin: "task", targetPin: "task" }
    ]
  });
}

describe("delegate workflow node", () => {
  it("starts a specialist run and returns its confirmed result", async () => {
    const parsed = delegateGraph();
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;
    const runAgent = vi.fn().mockResolvedValue({ runId: "run_1", agentId: "agent_1", status: "completed", result: "finished" });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "delegate", goal: "delegate", startNodeId: "start", keys: { projectKey: "PLAN", agentId: "agent_1", task: "Inspect it" } }),
      adapters: { runAgent }
    });
    expect(result.kind, result.kind === "failed" ? result.message : "").toBe("completed");
    expect(runAgent).toHaveBeenCalledWith({ agentId: "agent_1", task: "Inspect it", projectKey: "PLAN" });
    expect(result.bag.frame?.pins["delegate::delegationResult"]).toBe("finished");
  });

  it("persists a waiting run as pendingDelegation", async () => {
    const parsed = delegateGraph();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "delegate", goal: "delegate", startNodeId: "start", keys: { projectKey: "PLAN", agentId: "agent_1", task: "Inspect it" } }),
      adapters: { runAgent: async () => ({ runId: "run_1", agentId: "agent_1", status: "waiting", question: "Which file?" }) }
    });
    expect(result.kind, result.kind === "failed" ? result.message : "").toBe("completed");
    expect(result.bag.frame?.pins["delegate::pendingDelegation"]).toEqual({ runId: "run_1", agentId: "agent_1", task: "Inspect it", question: "Which file?" });
  });

  it("resumes a waiting run with the follow-up message", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [
        { name: "projectKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "runId", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "message", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "pendingDelegation", role: "input", shape: { kind: "any" }, required: false }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "delegate", type: "delegate", position: { x: 100, y: 0 }, data: { title: "Resume" } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "next_a", source: "start", target: "delegate", kind: "next" },
        { id: "next_b", source: "delegate", target: "end", kind: "next" },
        { id: "run", source: "start", target: "delegate", kind: "data", sourcePin: "runId", targetPin: "runId" },
        { id: "message", source: "start", target: "delegate", kind: "data", sourcePin: "message", targetPin: "message" },
        { id: "pending", source: "start", target: "delegate", kind: "data", sourcePin: "pendingDelegation", targetPin: "pendingDelegation" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const resumeAgent = vi.fn().mockResolvedValue({ runId: "run_1", agentId: "agent_1", status: "completed", result: "continued" });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "delegate", goal: "resume", startNodeId: "start", keys: { projectKey: "PLAN", runId: "run_1", message: "Here is the file", pendingDelegation: { runId: "run_1", agentId: "agent_1", task: "Inspect it" } } }),
      adapters: { resumeAgent }
    });
    expect(result.kind, result.kind === "failed" ? result.message : "").toBe("completed");
    expect(resumeAgent).toHaveBeenCalledWith({ runId: "run_1", message: "Here is the file", projectKey: "PLAN" });
  });
});

import { describe, expect, it } from "vitest";
import type { WorkflowContextBag, WorkflowGraph } from "../workflow/graph";
import { projectAssistantTrace } from "./trace";

const graph: WorkflowGraph = {
  version: 4,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
    { id: "llm_decide", type: "llm", position: { x: 100, y: 0 }, data: { title: "Assistant decision" } },
    { id: "break_decision", type: "break", position: { x: 200, y: 0 }, data: { title: "Break route" } },
    { id: "list_agents", type: "query", position: { x: 300, y: 0 }, data: { title: "List active agents" } },
    { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
  ],
  edges: []
};

function bag(overrides: Partial<WorkflowContextBag> = {}): WorkflowContextBag {
  return {
    workflowId: "flow_assistant_turn",
    cursor: null,
    goal: "Assistant turn",
    keys: { assistantSessionId: "asst_1", secretContext: "must not escape" },
    status: "completed",
    history: [
      { seq: 1, nodeId: "start", visit: 1, createdAt: "2026-09-12T10:00:00.000Z" },
      { seq: 2, nodeId: "llm_decide", visit: 1, createdAt: "2026-09-12T10:00:01.000Z" },
      { seq: 3, nodeId: "break_decision", visit: 1, createdAt: "2026-09-12T10:00:02.000Z" },
      { seq: 4, nodeId: "list_agents", visit: 1, createdAt: "2026-09-12T10:00:03.000Z" },
      { seq: 5, nodeId: "end", visit: 1, createdAt: "2026-09-12T10:00:04.000Z" }
    ],
    frame: {
      inputs: {},
      outputs: {},
      locals: {},
      pins: {
        "break_decision::route": "retrieve",
        "break_decision::lookupKind": "agents"
      }
    },
    ...overrides
  };
}

describe("Assistant trace projection", () => {
  it("projects ordered operational steps and structured route metadata", () => {
    const trace = projectAssistantTrace({
      id: "run_1",
      status: "completed",
      definitionSnapshot: graph,
      bag: bag(),
      startedAt: "2026-09-12T10:00:00.000Z",
      finishedAt: "2026-09-12T10:00:05.000Z"
    });

    expect(trace).toMatchObject({ runId: "run_1", status: "completed", route: "retrieve", lookupKind: "agents" });
    expect(trace.steps.map((step) => ({ nodeId: step.nodeId, title: step.title, type: step.type }))).toEqual([
      { nodeId: "start", title: "Start", type: "start" },
      { nodeId: "llm_decide", title: "Assistant decision", type: "llm" },
      { nodeId: "break_decision", title: "Break route", type: "break" },
      { nodeId: "list_agents", title: "List active agents", type: "query" },
      { nodeId: "end", title: "End", type: "end" }
    ]);
    expect(JSON.stringify(trace)).not.toContain("secretContext");
    expect(JSON.stringify(trace)).not.toContain("must not escape");
  });

  it("reports a failed current node and delegation metadata", () => {
    const trace = projectAssistantTrace({
      id: "run_2",
      status: "failed",
      definitionSnapshot: graph,
      bag: bag({
        cursor: "llm_decide",
        status: "failed",
        frame: {
          inputs: {},
          outputs: {},
          locals: {},
          pins: {
            "break_decision::route": "delegate",
            "break_decision::agentId": "agent_coding",
            "delegate::delegationStatus": "failed"
          }
        }
      }),
      error: "Agent unavailable.",
      startedAt: "2026-09-12T10:00:00.000Z"
    });

    expect(trace.status).toBe("failed");
    expect(trace.error).toBe("Agent unavailable.");
    expect(trace.route).toBe("delegate");
    expect(trace.delegation).toEqual({ agentId: "agent_coding", status: "failed" });
    expect(trace.steps.find((step) => step.nodeId === "llm_decide")?.status).toBe("failed");
  });
});

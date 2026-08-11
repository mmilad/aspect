import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../../../workflow";
import { WorkflowRun } from "../../../workflow/runtime";

describe("control node execute", () => {
  it("fork sets frontier and advances to first next arm", async () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        { id: "fork", type: "fork", position: { x: 100, y: 0 }, data: { title: "Fork" } },
        { id: "a", type: "end", position: { x: 200, y: -40 }, data: { title: "A" } },
        { id: "b", type: "end", position: { x: 200, y: 40 }, data: { title: "B" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "fork", kind: "next" },
        { id: "e2", source: "fork", target: "a", kind: "next" },
        { id: "e3", source: "fork", target: "b", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const bag = createContextBag({ workflowId: "w", goal: "g", startNodeId: "start" });
    const run = new WorkflowRun({ graph: parsed.graph, bag });
    const afterStart = await run.step();
    expect(afterStart.kind).toBe("advanced");
    const afterFork = await run.step();
    expect(afterFork.kind).toBe("advanced");
    expect(afterFork.bag.frontier).toEqual(["a", "b"]);
    expect(afterFork.bag.cursor).toBe("a");
  });

  it("wait delayMs=0 advances immediately", async () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        {
          id: "wait",
          type: "wait",
          position: { x: 100, y: 0 },
          data: { title: "Wait", wait: { delayMs: 0 } }
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "wait", kind: "next" },
        { id: "e2", source: "wait", target: "end", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const bag = createContextBag({ workflowId: "w", goal: "g", startNodeId: "start" });
    const result = await new WorkflowRun({ graph: parsed.graph, bag }).runUntilPause();
    expect(result.kind).toBe("completed");
  });

  it("join writes merge.as and advances", async () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        {
          id: "join",
          type: "join",
          position: { x: 100, y: 0 },
          data: {
            title: "Join",
            writes: ["branchResults"],
            join: { mode: "all", merge: { as: "branchResults", keys: ["goal"] } }
          }
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "join", kind: "depends_on" },
        { id: "e2", source: "start", target: "join", kind: "depends_on", label: "arm2" },
        { id: "e3", source: "join", target: "end", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const bag = createContextBag({ workflowId: "w", goal: "g", startNodeId: "join" });
    const result = await new WorkflowRun({ graph: parsed.graph, bag }).step();
    expect(result.kind).toBe("advanced");
    expect(result.bag.keys.branchResults).toBeTruthy();
    expect(result.bag.cursor).toBe("end");
  });
});

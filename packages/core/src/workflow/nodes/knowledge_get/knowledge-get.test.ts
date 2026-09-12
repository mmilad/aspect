import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

function graph() {
  return parseWorkflowGraph({
    version: 4,
    variables: [
      { name: "datasetKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
      { name: "itemId", role: "input", shape: { kind: "primitive", type: "string" }, required: true }
    ],
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      { id: "get", type: "knowledge_get", position: { x: 100, y: 0 }, data: { title: "Get knowledge" } },
      { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      { id: "next_a", source: "start", target: "get", kind: "next" },
      { id: "next_b", source: "get", target: "end", kind: "next" },
      { id: "dataset", source: "start", target: "get", kind: "data", sourcePin: "datasetKey", targetPin: "datasetKey" },
      { id: "item", source: "start", target: "get", kind: "data", sourcePin: "itemId", targetPin: "itemId" }
    ]
  });
}

describe("knowledge_get workflow node", () => {
  it("reads a visible item and exposes found state", async () => {
    const parsed = graph();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const knowledgeGet = vi.fn().mockResolvedValue({
      item: {
        id: "memory-1",
        datasetKey: "project-plan",
        rawText: "A fact",
        metadata: {},
        scope: { kind: "project", projectKey: "PLAN" }
      }
    });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "knowledge", goal: "get", startNodeId: "start", keys: { datasetKey: "project-plan", itemId: "memory-1" } }),
      adapters: { knowledgeGet }
    });
    expect(result.kind).toBe("completed");
    expect(knowledgeGet).toHaveBeenCalledWith({ datasetKey: "project-plan", itemId: "memory-1" });
    expect(result.bag.frame?.pins["get::found"]).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

function graph() {
  return parseWorkflowGraph({
    version: 4,
    variables: [
      { name: "datasetKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
      { name: "query", role: "input", shape: { kind: "primitive", type: "string" }, required: true }
    ],
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      { id: "search", type: "knowledge_search", position: { x: 100, y: 0 }, data: { title: "Search knowledge" } },
      { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      { id: "next_a", source: "start", target: "search", kind: "next" },
      { id: "next_b", source: "search", target: "end", kind: "next" },
      { id: "dataset", source: "start", target: "search", kind: "data", sourcePin: "datasetKey", targetPin: "datasetKey" },
      { id: "query", source: "start", target: "search", kind: "data", sourcePin: "query", targetPin: "query" }
    ]
  });
}

describe("knowledge_search workflow node", () => {
  it("passes scoped search input to the adapter and exposes normalized outputs", async () => {
    const parsed = graph();
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;
    const knowledgeSearch = vi.fn().mockResolvedValue({
      hits: [{ id: "memory-1", datasetKey: "project-plan", rawText: "A fact", metadata: {}, scope: { kind: "project", projectKey: "PLAN" }, score: 0.9 }],
      query: "A fact",
      embeddingModel: "fixture-embed",
      totalSearched: 1,
      searchMode: "vector"
    });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "knowledge", goal: "search", startNodeId: "start", keys: { datasetKey: "project-plan", query: "A fact" } }),
      adapters: { knowledgeSearch }
    });
    expect(result.kind, result.kind === "failed" ? result.message : "").toBe("completed");
    expect(knowledgeSearch).toHaveBeenCalledWith({ datasetKey: "project-plan", query: "A fact", topK: 10 });
    expect(result.bag.frame?.pins["search::hits"]).toHaveLength(1);
    expect(result.bag.frame?.pins["search::embeddingModel"]).toBe("fixture-embed");
  });

  it("fails clearly when the provider is not configured", async () => {
    const parsed = graph();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "knowledge", goal: "search", startNodeId: "start", keys: { datasetKey: "project-plan", query: "A fact" } })
    });
    expect(result.kind).toBe("failed");
    expect(result.message).toContain("Knowledge search is not configured");
  });
});

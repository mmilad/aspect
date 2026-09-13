import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("knowledge_context_index workflow node", () => {
  it("exposes the confirmed CortexDB catalog", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "catalog", type: "knowledge_context_index", position: { x: 100, y: 0 }, data: { title: "Catalog", knowledgeContextIndex: {} } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "next_a", source: "start", target: "catalog", kind: "next" },
        { id: "next_b", source: "catalog", target: "end", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const knowledgeContextIndex = vi.fn().mockResolvedValue({
      datasets: [{ key: "project_facts", displayName: "Project facts", capabilities: ["vector"], entityTypes: [], accessPatterns: ["semantic_search"], status: "active" }],
      tools: [],
      relationshipCount: 0,
      usageHint: "Search the relevant dataset."
    });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "knowledge-catalog", goal: "read", startNodeId: "start", keys: {} }),
      adapters: { knowledgeContextIndex }
    });
    expect(result.kind).toBe("completed");
    expect(knowledgeContextIndex).toHaveBeenCalledTimes(1);
    expect(result.bag.frame?.pins["catalog::datasets"]).toEqual([
      expect.objectContaining({ key: "project_facts", displayName: "Project facts" })
    ]);
  });
});

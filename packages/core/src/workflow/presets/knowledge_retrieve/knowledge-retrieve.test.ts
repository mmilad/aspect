import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";
import { knowledgeRetrieveGraph } from "./graph";

describe("knowledge_retrieve preset", () => {
  it("passes retrieval controls through the workflow and returns provider evidence", async () => {
    const knowledgeSearch = vi.fn().mockResolvedValue({
      hits: [{ id: "memory-1", datasetKey: "project-plan", rawText: "The release target is September.", metadata: {}, scope: { kind: "project", projectKey: "PLAN" }, score: 0.92 }],
      query: "release target",
      embeddingModel: "ollama/nomic-embed-text:latest",
      totalSearched: 1,
      searchMode: "vector"
    });
    const parsed = parseWorkflowGraph(knowledgeRetrieveGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;

    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "flow_knowledge_retrieve",
        goal: "retrieve project knowledge",
        startNodeId: "start",
        actor: "agent",
        keys: {
          datasetKey: "project-plan",
          query: "release target",
          topK: 5,
          metadataFilters: { source: "roadmap" },
          access: { projectKey: "PLAN", includeGlobal: true }
        }
      }),
      adapters: { knowledgeSearch }
    });

    expect(result.kind, result.kind === "failed" ? result.message : "").toBe("completed");
    expect(knowledgeSearch).toHaveBeenCalledWith({
      datasetKey: "project-plan",
      query: "release target",
      topK: 5,
      metadataFilters: { source: "roadmap" },
      access: { projectKey: "PLAN", includeGlobal: true }
    });
    expect(result.bag.frame?.outputs.hits).toHaveLength(1);
    expect(result.bag.frame?.outputs.searchQuery).toBe("release target");
    expect(result.bag.frame?.outputs.searchMode).toBe("vector");
  });
});

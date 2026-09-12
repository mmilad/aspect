import { describe, expect, it, vi } from "vitest";
import { createKnowledgeSearchProvider } from "../packages/db/src/knowledge";

describe("CortexDB knowledge adapter", () => {
  it("maps the CortexDB response and preserves scoped access", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      hits: [{
        item: {
          id: "memory-1",
          dataset_key: "project-plan",
          raw_text: "A fact",
          metadata: { kind: "note" },
          scope: { kind: "project", project_key: "PLAN" },
          embedding_model: "fixture-embed"
        },
        score: 0.9,
        vector_score: 0.9,
        keyword_score: null
      }],
      query: "A fact",
      embedding_model: "fixture-embed",
      total_searched: 1,
      search_mode: "vector"
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await createKnowledgeSearchProvider("http://cortex.test/")({
        datasetKey: "project-plan",
        query: "A fact",
        topK: 5,
        access: { projectKey: "PLAN", includeGlobal: true }
      });
      expect(result.hits[0]).toMatchObject({ id: "memory-1", datasetKey: "project-plan", score: 0.9 });
      expect(result.hits[0]?.scope.projectKey).toBe("PLAN");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://cortex.test/datasets/project-plan/search",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query: "A fact", top_k: 5, access: { project_key: "PLAN", include_global: true } })
        })
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

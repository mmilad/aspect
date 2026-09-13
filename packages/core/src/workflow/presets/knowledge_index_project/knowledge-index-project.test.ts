import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";
import { knowledgeIndexProjectGraph } from "./graph";

describe("knowledge_index_project preset", () => {
  it("projects entities with stable provenance and project scope", async () => {
    const listEntities = vi.fn().mockResolvedValue([
      { id: "feature-1", type: "feature", title: "Release", summary: "Ship it.", body: "September target.", status: "planned" },
      { id: "empty-1", type: "task", title: "", summary: "", body: "", status: "planned" }
    ]);
    const knowledgeIngestText = vi.fn().mockResolvedValue({ ingested: 2, ids: ["memory-1", "memory-2"], embeddingModel: "fixture-embed" });
    const parsed = parseWorkflowGraph(knowledgeIndexProjectGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;

    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "flow_knowledge_index_project",
        goal: "index project knowledge",
        startNodeId: "start",
        actor: "agent",
        keys: { projectKey: "PLAN", datasetKey: "project-plan", limit: 50 }
      }),
      adapters: { listEntities, knowledgeIngestText }
    });

    expect(result.kind, result.kind === "failed" ? result.message : "").toBe("completed");
    expect(listEntities).toHaveBeenCalledWith({ projectKey: "PLAN", limit: 50, includeArchived: false, select: "full" });
    expect(knowledgeIngestText).toHaveBeenCalledWith({
      datasetKey: "project-plan",
      text: "feature\n\nRelease\n\nShip it.\n\nSeptember target.",
      ingestionId: "projectplaner:entity:feature-1",
      metadata: expect.objectContaining({ source: "projectplaner", entityId: "feature-1", projectKey: "PLAN" }),
      scope: { kind: "project", projectKey: "PLAN", sourceId: "feature-1" }
    });
    expect(result.bag.frame?.outputs.indexed).toBe(2);
    expect(result.bag.frame?.outputs.ids).toEqual(["memory-1", "memory-2"]);
    expect(result.bag.frame?.outputs.skipped).toBe(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";
import { knowledgeCaptureGraph } from "./graph";

describe("knowledge_capture preset", () => {
  it("ingests only through the typed workflow adapter and returns the confirmed result", async () => {
    const knowledgeIngestText = vi.fn().mockResolvedValue({ ingested: 1, ids: ["memory-1"], embeddingModel: "fixture-embed" });
    const parsed = parseWorkflowGraph(knowledgeCaptureGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;

    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "flow_knowledge_capture",
        goal: "capture approved knowledge",
        startNodeId: "start",
        actor: "agent",
        keys: {
          datasetKey: "project-plan",
          rawText: "The release target is September.",
          itemId: "note-1",
          metadata: { source: "project-note" },
          scope: { kind: "project", projectKey: "PLAN" }
        }
      }),
      adapters: { knowledgeIngestText }
    });

    expect(result.kind, result.message ?? result.bag.error ?? "").toBe("completed");
    expect(knowledgeIngestText).toHaveBeenCalledWith({
      datasetKey: "project-plan",
      text: "The release target is September.",
      ingestionId: "note-1",
      metadata: { source: "project-note" },
      scope: { kind: "project", projectKey: "PLAN" }
    });
    expect(result.bag.frame?.outputs.ingested).toBe(1);
    expect(result.bag.frame?.outputs.ids).toEqual(["memory-1"]);
    expect(result.bag.frame?.outputs.embeddingModel).toBe("fixture-embed");
  });
});

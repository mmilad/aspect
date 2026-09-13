import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";
import { knowledgePromoteGraph } from "./graph";

const classification = {
  decision: "durable",
  kind: "preference",
  confidence: 0.95,
  canonicalText: "The user prefers compact project updates.",
  sourceQuote: "Keep updates compact.",
  suggestedDatasetKey: "personal-memory",
  suggestedScope: "personal",
  needsConfirmation: false,
  reason: "Explicit preference."
};

describe("knowledge_promote preset", () => {
  it("stores only explicitly confirmed knowledge with provenance", async () => {
    const knowledgeIngestText = vi.fn().mockResolvedValue({ ingested: 1, ids: ["memory-1"], embeddingModel: "fixture/embed" });
    const parsed = parseWorkflowGraph(knowledgePromoteGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "knowledge-promote",
        goal: "remember",
        startNodeId: "start",
        actor: "agent",
        keys: {
          classification,
          datasetKey: "personal-memory",
          scope: { kind: "personal", ownerId: "alice" },
          confirmed: true,
          sourceId: "message-1"
        }
      }),
      adapters: { knowledgeIngestText }
    });

    expect(result.kind).toBe("completed");
    expect(knowledgeIngestText).toHaveBeenCalledWith({
      datasetKey: "personal-memory",
      text: classification.canonicalText,
      scope: { kind: "personal", ownerId: "alice" },
      ingestionId: "projectplaner:memory:message-1",
      metadata: expect.objectContaining({
        source: "projectplaner:knowledge_promote",
        memoryRole: "durable_fact",
        kind: "preference",
        confidence: 0.95,
        sourceQuote: "Keep updates compact.",
        sourceId: "message-1"
      })
    });
    expect(result.bag.frame?.outputs.status).toBe("promoted");
  });

  it("does not call the write adapter before confirmation", async () => {
    const knowledgeIngestText = vi.fn();
    const parsed = parseWorkflowGraph(knowledgePromoteGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "knowledge-promote-pending",
        goal: "remember",
        startNodeId: "start",
        actor: "agent",
        keys: {
          classification,
          datasetKey: "personal-memory",
          scope: { kind: "personal", ownerId: "alice" },
          confirmed: false,
          sourceId: "message-2"
        }
      }),
      adapters: { knowledgeIngestText }
    });

    expect(result.kind).toBe("completed");
    expect(knowledgeIngestText).not.toHaveBeenCalled();
    expect(result.bag.frame?.outputs.status).toBe("needs_confirmation");
  });
});

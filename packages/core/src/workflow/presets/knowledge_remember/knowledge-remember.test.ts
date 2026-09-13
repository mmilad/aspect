import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause, stepWorkflow } from "../../runtime";
import { knowledgeRememberGraph } from "./graph";

const classification = {
  decision: "durable",
  kind: "preference",
  confidence: 0.98,
  canonicalText: "The user prefers concise replies.",
  sourceQuote: "Please keep replies concise.",
  suggestedDatasetKey: "user-memory",
  suggestedScope: "personal",
  needsConfirmation: true,
  reason: "The user stated a stable communication preference."
};

function bag(confirmed: boolean) {
  return createContextBag({
    workflowId: "knowledge_remember",
    goal: "remember",
    startNodeId: "start",
    keys: {
      rawText: "Please keep replies concise.",
      projectKey: "PLAN",
      datasetKey: "user-memory",
      scope: { kind: "personal", ownerId: "alice" },
      confirmed,
      ingestionId: "memory:alice:concise"
    }
  });
}

describe("knowledge_remember preset", () => {
  it("classifies first and stores only after explicit confirmation", async () => {
    const parsed = parseWorkflowGraph(knowledgeRememberGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;
    const knowledgeIngestText = vi.fn().mockResolvedValue({ ingested: 1, ids: ["memory-1"], embeddingModel: "fixture/embed" });

    let result = await runWorkflowUntilPause({ graph: parsed.graph, bag: bag(true), adapters: { knowledgeIngestText } });
    expect(result.kind).toBe("pending_llm");
    expect(result.nodeId).toBe("classify");
    result = await stepWorkflow({ graph: parsed.graph, bag: result.bag, llmWrites: { classification } , adapters: { knowledgeIngestText } });
    result = await runWorkflowUntilPause({ graph: parsed.graph, bag: result.bag, adapters: { knowledgeIngestText } });

    expect(result.kind).toBe("completed");
    expect(knowledgeIngestText).toHaveBeenCalledWith(expect.objectContaining({
      datasetKey: "user-memory",
      text: "The user prefers concise replies.",
      scope: { kind: "personal", ownerId: "alice" },
      ingestionId: "memory:alice:concise"
    }));
    expect(result.bag.frame?.outputs.status).toBe("promoted");
    expect(result.bag.frame?.outputs.classification).toEqual(classification);
  });

  it("returns needs_confirmation without calling the ingest adapter", async () => {
    const parsed = parseWorkflowGraph(knowledgeRememberGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const knowledgeIngestText = vi.fn();

    let result = await runWorkflowUntilPause({ graph: parsed.graph, bag: bag(false), adapters: { knowledgeIngestText } });
    result = await stepWorkflow({ graph: parsed.graph, bag: result.bag, llmWrites: { classification }, adapters: { knowledgeIngestText } });
    result = await runWorkflowUntilPause({ graph: parsed.graph, bag: result.bag, adapters: { knowledgeIngestText } });

    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.status).toBe("needs_confirmation");
    expect(knowledgeIngestText).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause, stepWorkflow } from "../../runtime";
import { knowledgeClassifyGraph } from "./graph";

describe("knowledge_classify preset", () => {
  it("returns a classification proposal without invoking a write adapter", async () => {
    const parsed = parseWorkflowGraph(knowledgeClassifyGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    if (!parsed.ok) return;

    const bag = createContextBag({
      workflowId: "flow_knowledge_classify",
      goal: "classify a source item",
      startNodeId: "start",
      actor: "agent",
      keys: { rawText: "I prefer local Postgres.", projectKey: "PLAN", metadata: { source: "chat" } }
    });
    const pending = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(pending.kind).toBe("pending_llm");
    expect(pending.nodeId).toBe("classify");
    expect(pending.llm?.schemaKey).toBe("knowledge_classification_v1");

    const classification = {
      decision: "candidate",
      kind: "preference",
      confidence: 0.96,
      canonicalText: "The user prefers local Postgres.",
      sourceQuote: "I prefer local Postgres.",
      suggestedDatasetKey: "project-plan",
      suggestedScope: "personal",
      needsConfirmation: true,
      reason: "The source expresses a user preference and should be confirmed before promotion."
    };
    const advanced = await stepWorkflow({ graph: parsed.graph, bag: pending.bag, llmWrites: { classification } });
    expect(advanced.kind).toBe("advanced");
    const completed = await runWorkflowUntilPause({ graph: parsed.graph, bag: advanced.bag });
    expect(completed.kind).toBe("completed");
    expect(completed.bag.frame?.outputs.classification).toEqual(classification);
  });
});

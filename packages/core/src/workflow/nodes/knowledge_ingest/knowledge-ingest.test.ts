import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("knowledge_ingest workflow node", () => {
  it("passes raw text and scope to the provider and exposes confirmed outputs", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [
        { name: "datasetKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "rawText", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "scope", role: "input", shape: { kind: "any" }, required: false }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "ingest", type: "knowledge_ingest", position: { x: 100, y: 0 }, data: { title: "Ingest" } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "next_a", source: "start", target: "ingest", kind: "next" },
        { id: "next_b", source: "ingest", target: "end", kind: "next" },
        { id: "dataset", source: "start", target: "ingest", kind: "data", sourcePin: "datasetKey", targetPin: "datasetKey" },
        { id: "text", source: "start", target: "ingest", kind: "data", sourcePin: "rawText", targetPin: "rawText" },
        { id: "scope", source: "start", target: "ingest", kind: "data", sourcePin: "scope", targetPin: "scope" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const knowledgeIngest = vi.fn().mockResolvedValue({ ingested: 1, ids: ["memory-1"], embeddingModel: "fixture/embed" });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "knowledge", goal: "ingest", startNodeId: "start", keys: {
        datasetKey: "project-plan",
        rawText: "A fact",
        scope: { kind: "project", projectKey: "PLAN" }
      } }),
      adapters: { knowledgeIngest }
    });
    expect(result.kind).toBe("completed");
    expect(knowledgeIngest).toHaveBeenCalledWith({
      datasetKey: "project-plan",
      items: [{ rawText: "A fact", scope: { kind: "project", projectKey: "PLAN" } }]
    });
    expect(result.bag.frame?.pins["ingest::ids"]).toEqual(["memory-1"]);
  });
});

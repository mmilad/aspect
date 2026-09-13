import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("knowledge_ingest_text workflow node", () => {
  it("passes scoped text ingest options and exposes confirmed outputs", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [
        { name: "datasetKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "text", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "scope", role: "input", shape: { kind: "any" }, required: false },
        { name: "maxChars", role: "input", shape: { kind: "primitive", type: "number" }, required: false },
        { name: "extractPrimitives", role: "input", shape: { kind: "primitive", type: "boolean" }, required: false }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "ingest",
          type: "knowledge_ingest_text",
          position: { x: 100, y: 0 },
          data: { title: "Ingest text", knowledgeIngestText: { datasetKeyFrom: "datasetKey" } }
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "next_a", source: "start", target: "ingest", kind: "next" },
        { id: "next_b", source: "ingest", target: "end", kind: "next" },
        { id: "dataset", source: "start", target: "ingest", kind: "data", sourcePin: "datasetKey", targetPin: "datasetKey" },
        { id: "text", source: "start", target: "ingest", kind: "data", sourcePin: "text", targetPin: "text" },
        { id: "scope", source: "start", target: "ingest", kind: "data", sourcePin: "scope", targetPin: "scope" },
        { id: "max", source: "start", target: "ingest", kind: "data", sourcePin: "maxChars", targetPin: "maxChars" },
        { id: "extract", source: "start", target: "ingest", kind: "data", sourcePin: "extractPrimitives", targetPin: "extractPrimitives" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const knowledgeIngestText = vi.fn().mockResolvedValue({
      ingested: 2,
      ids: ["memory-1", "memory-2"],
      embeddingModel: "fixture/embed"
    });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "knowledge-text",
        goal: "ingest",
        startNodeId: "start",
        keys: {
          datasetKey: "project-plan",
          text: "A fact",
          scope: { kind: "project", projectKey: "PLAN" },
          maxChars: 512,
          extractPrimitives: true
        }
      }),
      adapters: { knowledgeIngestText }
    });

    expect(result.kind).toBe("completed");
    expect(knowledgeIngestText).toHaveBeenCalledWith({
      datasetKey: "project-plan",
      text: "A fact",
      scope: { kind: "project", projectKey: "PLAN" },
      maxChars: 512,
      extractPrimitives: true
    });
    expect(result.bag.frame?.pins["ingest::ids"]).toEqual(["memory-1", "memory-2"]);
    expect(result.bag.frame?.pins["ingest::ingested"]).toBe(2);
  });
});

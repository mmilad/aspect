import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("knowledge_register_dataset workflow node", () => {
  it("registers the declared dataset and exposes only confirmed metadata", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [
        { name: "datasetKey", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "displayName", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "schemaVersion", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "semanticDescription", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "usageGuidance", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "capabilityTags", role: "input", shape: { kind: "array", items: { kind: "primitive", type: "string" } }, required: false }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "register", type: "knowledge_register_dataset", position: { x: 100, y: 0 }, data: { title: "Register", knowledgeRegisterDataset: {} } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "next_a", source: "start", target: "register", kind: "next" },
        { id: "next_b", source: "register", target: "end", kind: "next" },
        ...["datasetKey", "displayName", "schemaVersion", "semanticDescription", "usageGuidance", "capabilityTags"].map((key) => ({ id: `data_${key}`, source: "start", target: "register", kind: "data" as const, sourcePin: key, targetPin: key }))
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const knowledgeRegisterDataset = vi.fn().mockResolvedValue({
      datasetKey: "project_facts",
      displayName: "Project facts",
      schemaVersion: "1",
      semanticDescription: "Facts",
      usageGuidance: "Search before answering.",
      status: "active"
    });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "knowledge-register",
        goal: "register",
        startNodeId: "start",
        keys: {
          datasetKey: "project_facts",
          displayName: "Project facts",
          schemaVersion: "1",
          semanticDescription: "Facts",
          usageGuidance: "Search before answering.",
          capabilityTags: ["project"]
        }
      }),
      adapters: { knowledgeRegisterDataset }
    });

    expect(result.kind).toBe("completed");
    expect(knowledgeRegisterDataset).toHaveBeenCalledWith({
      datasetKey: "project_facts",
      displayName: "Project facts",
      schemaVersion: "1",
      semanticDescription: "Facts",
      usageGuidance: "Search before answering.",
      capabilityTags: ["project"]
    });
    expect(result.bag.frame?.pins["register::registered"]).toBe(true);
  });
});

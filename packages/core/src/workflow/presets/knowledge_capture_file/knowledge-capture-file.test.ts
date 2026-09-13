import { describe, expect, it, vi } from "vitest";
import { createContextBag } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";
import { knowledgeCaptureFileGraph } from "./graph";

describe("knowledge_capture_file preset", () => {
  it("reads bounded file content before ingesting it", async () => {
    const fileRead = vi.fn().mockResolvedValue({
      path: "notes/plan.md",
      content: "approved note",
      bytes: 13,
      truncated: false,
      encoding: "utf8"
    });
    const knowledgeIngestText = vi.fn().mockResolvedValue({
      ingested: 1,
      ids: ["knowledge:1"],
      embeddingModel: "test-model"
    });

    const result = await runWorkflowUntilPause({
      graph: knowledgeCaptureFileGraph,
      bag: createContextBag({
        workflowId: "knowledge_capture_file",
        goal: "capture",
        startNodeId: "start",
        keys: {
          datasetKey: "project-notes",
          filePath: "notes/plan.md",
          ingestionId: "file:notes/plan.md",
          scope: { kind: "project", projectKey: "PLAN" }
        }
      }),
      adapters: { fileRead, knowledgeIngestText }
    });

    expect(result.kind).toBe("completed");
    expect(fileRead).toHaveBeenCalledWith({ path: "notes/plan.md" });
    expect(knowledgeIngestText).toHaveBeenCalledWith({
      datasetKey: "project-notes",
      text: "approved note",
      ingestionId: "file:notes/plan.md",
      scope: { kind: "project", projectKey: "PLAN" }
    });
    expect(result.bag.frame?.pins["end::sourcePath"]).toBe("notes/plan.md");
    expect(result.bag.frame?.pins["end::ingested"]).toBe(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("file_list workflow node", () => {
  it("passes bounded listing options to the file adapter", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [
        { name: "path", role: "input", shape: { kind: "primitive", type: "string" }, required: false },
        { name: "recursive", role: "input", shape: { kind: "primitive", type: "boolean" }, required: false },
        { name: "maxEntries", role: "input", shape: { kind: "primitive", type: "number" }, required: false }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "list", type: "file_list", position: { x: 100, y: 0 }, data: { title: "List" } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "a", source: "start", target: "list", kind: "next" },
        { id: "b", source: "list", target: "end", kind: "next" },
        { id: "p", source: "start", target: "list", kind: "data", sourcePin: "path", targetPin: "path" },
        { id: "r", source: "start", target: "list", kind: "data", sourcePin: "recursive", targetPin: "recursive" },
        { id: "m", source: "start", target: "list", kind: "data", sourcePin: "maxEntries", targetPin: "maxEntries" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fileList = vi.fn().mockResolvedValue({ entries: [{ path: "src", kind: "directory" }] });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "files", goal: "list", startNodeId: "start", keys: { path: "src", recursive: true, maxEntries: 4 } }),
      adapters: { fileList }
    });
    expect(result.kind).toBe("completed");
    expect(fileList).toHaveBeenCalledWith({ path: "src", recursive: true, maxEntries: 4 });
    expect(result.bag.frame?.pins["list::entries"]).toEqual([{ path: "src", kind: "directory" }]);
  });
});

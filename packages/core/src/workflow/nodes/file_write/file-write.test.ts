import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("file_write workflow node", () => {
  it("passes explicit overwrite authorization and exposes the confirmed result", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [
        { name: "path", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "content", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "overwrite", role: "input", shape: { kind: "primitive", type: "boolean" }, required: false }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "write", type: "file_write", position: { x: 100, y: 0 }, data: { title: "Write" } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "a", source: "start", target: "write", kind: "next" },
        { id: "b", source: "write", target: "end", kind: "next" },
        { id: "p", source: "start", target: "write", kind: "data", sourcePin: "path", targetPin: "path" },
        { id: "c", source: "start", target: "write", kind: "data", sourcePin: "content", targetPin: "content" },
        { id: "o", source: "start", target: "write", kind: "data", sourcePin: "overwrite", targetPin: "overwrite" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fileWrite = vi.fn().mockResolvedValue({ path: "README.md", bytes: 5, created: false, overwritten: true });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "files", goal: "write", startNodeId: "start", keys: { path: "README.md", content: "hello", overwrite: true } }),
      adapters: { fileWrite }
    });
    expect(result.kind).toBe("completed");
    expect(fileWrite).toHaveBeenCalledWith({ path: "README.md", content: "hello", overwrite: true });
    expect(result.bag.frame?.pins["write::overwritten"]).toBe(true);
  });
});

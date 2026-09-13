import { describe, expect, it, vi } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause } from "../../runtime";

describe("file_read workflow node", () => {
  it("exposes the confirmed bounded file result", async () => {
    const parsed = parseWorkflowGraph({
      version: 4,
      variables: [{ name: "path", role: "input", shape: { kind: "primitive", type: "string" }, required: true }],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "read", type: "file_read", position: { x: 100, y: 0 }, data: { title: "Read" } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "a", source: "start", target: "read", kind: "next" },
        { id: "b", source: "read", target: "end", kind: "next" },
        { id: "p", source: "start", target: "read", kind: "data", sourcePin: "path", targetPin: "path" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fileRead = vi.fn().mockResolvedValue({ path: "README.md", content: "hello", bytes: 5, truncated: false, encoding: "utf8" });
    const result = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({ workflowId: "files", goal: "read", startNodeId: "start", keys: { path: "README.md" } }),
      adapters: { fileRead }
    });
    expect(result.kind).toBe("completed");
    expect(fileRead).toHaveBeenCalledWith({ path: "README.md" });
    expect(result.bag.frame?.pins["read::content"]).toBe("hello");
  });
});

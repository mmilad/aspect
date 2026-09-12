import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../graph";
import { runWorkflowUntilPause } from "./index";

function graphFor(node: { type: string; data: Record<string, unknown> }) {
  return parseWorkflowGraph({
    version: 4,
    variables: [],
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      { id: "operation", type: node.type, position: { x: 100, y: 0 }, data: { title: "Operation", ...node.data } },
      { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      { id: "next_a", source: "start", target: "operation", kind: "next" },
      { id: "next_b", source: "operation", target: "end", kind: "next" }
    ]
  });
}

async function rejects(node: { type: string; data: Record<string, unknown> }, expected: string) {
  const parsed = graphFor(node);
  expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
  if (!parsed.ok) return;
  const result = await runWorkflowUntilPause({
    graph: parsed.graph,
    bag: createContextBag({ workflowId: "assistant", goal: "test", startNodeId: "start", actor: "assistant", keys: {} })
  });
  expect(result.kind).toBe("failed");
  expect(result.message).toContain(expected);
}

describe("Assistant workflow policy", () => {
  it("rejects mutation Query nodes", async () => {
    await rejects({ type: "query", data: { query: { op: "create_entity", type: "task" } } }, "rejects write node 'query'");
  });

  it("rejects write nodes", async () => {
    await rejects({ type: "write", data: { write: { action: "create_entity" } } }, "rejects write node 'write'");
  });

  it("rejects generic external Tool nodes", async () => {
    await rejects({ type: "tool", data: { tool: { name: "unknown" } } }, "rejects external node 'tool'");
  });
});

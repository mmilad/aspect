import { describe, expect, it } from "vitest";
import { parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../schema";
import { initFrameFromRunInputs, resolveDataInput, writeOutputPins } from "./frame";
import type { WorkflowContextBag } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };

describe("data reroute nodes", () => {
  it("parses a reroute and rejects exec into it", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "brief", role: "input", shape: STRING, required: true },
        { name: "draft", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "knot", type: "reroute", position: { x: 80, y: 0 }, data: { title: "Reroute" } },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "knot", kind: "data", sourcePin: "brief", targetPin: "value" },
        { id: "d2", source: "knot", target: "end", kind: "data", sourcePin: "value", targetPin: "draft" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);

    const execInto = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [{ name: "brief", role: "input", shape: STRING }],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "knot", type: "reroute", position: { x: 80, y: 0 }, data: { title: "Reroute" } },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "knot", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "knot", target: "end", kind: "next", sourcePin: "then", targetPin: "in" }
      ]
    });
    expect(execInto.ok).toBe(false);
    if (!execInto.ok) {
      expect(execInto.errors.some((error) => /reroute cannot be an exec target/i.test(error))).toBe(true);
    }
  });

  it("fans a start pin through a reroute chain to two receivers", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "brief", role: "input", shape: STRING, required: true },
        { name: "left", role: "output", shape: STRING, required: true },
        { name: "right", role: "output", shape: STRING, required: true }
      ],
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: { title: "Start", outputContracts: { brief: { required: true, shape: STRING } } }
        },
        { id: "knot", type: "reroute", position: { x: 80, y: 0 }, data: { title: "Reroute" } },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "knot", kind: "data", sourcePin: "brief", targetPin: "value" },
        { id: "d2", source: "knot", target: "end", kind: "data", sourcePin: "value", targetPin: "left" },
        { id: "d3", source: "knot", target: "end", kind: "data", sourcePin: "value", targetPin: "right" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const graph = parsed.graph;
    const bag: WorkflowContextBag = {
      workflowId: "wf",
      cursor: "start",
      goal: "test",
      keys: { brief: "hello" },
      status: "running"
    };
    bag.frame = initFrameFromRunInputs(graph, bag);
    const written = writeOutputPins(graph, bag, graph.nodes[0]!, { brief: "hello" });
    const end = graph.nodes.find((node) => node.type === "end")!;
    expect(resolveDataInput(graph, written, end, "left")).toBe("hello");
    expect(resolveDataInput(graph, written, end, "right")).toBe("hello");
  });
});

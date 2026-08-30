import { describe, expect, it } from "vitest";
import { parseWorkflowGraph } from "./schema";
import { WORKFLOW_SCHEMA_VERSION } from "../nodes";

describe("pin-variable schema", () => {
  it("parses graph.variables and kind:data", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [
        { name: "brief", role: "input", shape: { kind: "primitive", type: "string" }, required: true },
        { name: "draft", role: "output", shape: { kind: "any" }, required: true },
        { name: "scratch", role: "local", shape: { kind: "any" } }
      ],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "get_scratch",
          type: "get",
          position: { x: 80, y: 80 },
          data: { title: "Get", variable: "scratch" }
        },
        {
          id: "set_scratch",
          type: "set",
          position: { x: 160, y: 0 },
          data: { title: "Set", variable: "scratch" }
        },
        { id: "end", type: "end", position: { x: 320, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "set_scratch", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "set_scratch", target: "end", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "d1", source: "start", target: "set_scratch", kind: "data", sourcePin: "brief", targetPin: "value" },
        { id: "d2", source: "get_scratch", target: "end", kind: "data", sourcePin: "scratch", targetPin: "draft" }
      ]
    });
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("\n")).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.graph.variables).toHaveLength(3);
    expect(parsed.graph.nodes.find((node) => node.type === "start")?.data.outputContracts?.brief).toBeTruthy();
    expect(parsed.graph.nodes.find((node) => node.type === "end")?.data.inputs?.draft).toBeTruthy();
    expect(parsed.graph.edges.filter((edge) => edge.kind === "data")).toHaveLength(2);
  });

  it("rejects get as an exec target", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [{ name: "scratch", role: "local", shape: { kind: "any" } }],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "get_scratch", type: "get", position: { x: 80, y: 0 }, data: { title: "Get", variable: "scratch" } },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "get_scratch", kind: "next", sourcePin: "then", targetPin: "in" },
        { id: "e2", source: "get_scratch", target: "end", kind: "next", sourcePin: "then", targetPin: "in" }
      ]
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((error) => /get cannot be an exec target/i.test(error))).toBe(true);
    }
  });

  it("requires sourcePin and targetPin on data edges", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      variables: [{ name: "brief", role: "input", shape: { kind: "any" } }],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "end", type: "end", position: { x: 160, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "end", kind: "next" },
        { id: "d1", source: "start", target: "end", kind: "data" }
      ]
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((error) => /data edges require sourcePin/i.test(error))).toBe(true);
    }
  });
});

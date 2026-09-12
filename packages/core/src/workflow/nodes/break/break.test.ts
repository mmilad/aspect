import { describe, expect, it } from "vitest";
import { parseWorkflowGraph } from "../../graph";

describe("break workflow node", () => {
  it("parses a generic object split with aliases", () => {
    const result = parseWorkflowGraph({
      version: 4,
      variables: [],
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", outputContracts: {
          facts: { required: true, shape: { kind: "object", fields: {
            agents: { kind: "array", items: { kind: "unknown" } },
            project: { kind: "object", fields: { key: { kind: "primitive", type: "string" } } }
          } } }
        } } },
        { id: "break", type: "break", position: { x: 100, y: 0 }, data: { title: "Break", break: { from: "facts", fields: { agents: "projectAgents" } } } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "a", source: "start", target: "end", kind: "next" },
        { id: "b", source: "start", target: "break", kind: "data", sourcePin: "facts", targetPin: "value" }
      ]
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a break node without a source", () => {
    const result = parseWorkflowGraph({ version: 4, variables: [], nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      { id: "break", type: "break", position: { x: 100, y: 0 }, data: { title: "Break", break: {} } },
      { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
    ], edges: [
      { id: "a", source: "start", target: "end", kind: "next" },
      { id: "b", source: "start", target: "break", kind: "data", sourcePin: "facts", targetPin: "value" }
    ] });
    expect(result.ok).toBe(false);
  });
});

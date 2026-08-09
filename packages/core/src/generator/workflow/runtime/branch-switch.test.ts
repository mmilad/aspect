import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../../workflow";
import { stepWorkflow } from "./step";

describe("branch and switch runtime", () => {
  it("rewrites legacy true/false switch into branch on parse", () => {
    const parsed = parseWorkflowGraph({
      version: 2,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["flag"] } },
        {
          id: "sw",
          type: "switch",
          position: { x: 100, y: 0 },
          data: { title: "If", switch: { on: "flag" } }
        },
        { id: "a", type: "end", position: { x: 200, y: 0 }, data: { title: "A" } },
        { id: "b", type: "end", position: { x: 200, y: 80 }, data: { title: "B" } }
      ],
      edges: [
        { id: "e0", source: "start", target: "sw", kind: "next" },
        { id: "e1", source: "sw", target: "a", kind: "route", label: "true" },
        { id: "e2", source: "sw", target: "b", kind: "route", label: "false" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.graph.nodes.find((node) => node.id === "sw")?.type).toBe("branch");
  });

  it("switch uses default arm when discriminant misses", async () => {
    const parsed = parseWorkflowGraph({
      version: 2,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["kind"] } },
        {
          id: "sw",
          type: "switch",
          position: { x: 100, y: 0 },
          data: { title: "By kind", switch: { on: "kind", cases: ["create", "update"], defaultLabel: "default" } }
        },
        { id: "create", type: "end", position: { x: 200, y: 0 }, data: { title: "Create" } },
        { id: "update", type: "end", position: { x: 200, y: 80 }, data: { title: "Update" } },
        { id: "other", type: "end", position: { x: 200, y: 160 }, data: { title: "Default" } }
      ],
      edges: [
        { id: "e0", source: "start", target: "sw", kind: "next" },
        { id: "e1", source: "sw", target: "create", kind: "route", label: "create" },
        { id: "e2", source: "sw", target: "update", kind: "route", label: "update" },
        { id: "e3", source: "sw", target: "other", kind: "route", label: "default" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    let bag = createContextBag({
      workflowId: "wf",
      goal: "g",
      startNodeId: "start",
      keys: { kind: "unknown_op" }
    });
    let step = await stepWorkflow({ graph: parsed.graph, bag });
    bag = step.bag;
    step = await stepWorkflow({ graph: parsed.graph, bag });
    expect(step.kind).toBe("advanced");
    expect(step.nodeId).toBe("other");
  });
});

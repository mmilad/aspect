import { describe, expect, it } from "vitest";
import { scopedGraph, validateRelation } from "./relations";
import { selfPlanningSeed } from "./seed";

describe("relations", () => {
  it("validates relation endpoints", () => {
    expect(
      validateRelation(
        {
          sourceNodeId: "missing",
          targetNodeId: "node_project",
          type: "depends_on"
        },
        selfPlanningSeed.nodes
      )
    ).toContain("Source node does not exist.");
  });

  it("returns scoped graph nodes and internal relations", () => {
    const graph = scopedGraph("node_workspace", selfPlanningSeed.nodes, selfPlanningSeed.relations);
    expect(graph.nodes.map((node) => node.id)).toContain("node_graph_view");
    expect(graph.relations.every((relation) => graph.nodes.some((node) => node.id === relation.sourceNodeId))).toBe(true);
  });
});

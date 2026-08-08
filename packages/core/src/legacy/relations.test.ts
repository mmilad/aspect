import { describe, expect, it } from "vitest";
import { scopedGraph, validateRelation } from "./relations";
import type { ProjectNode, ProjectRelation } from "../domain/types";

const nodes: ProjectNode[] = [
  {
    id: "root",
    projectId: "p",
    parentId: null,
    type: "aspect",
    slug: "root",
    path: "root",
    title: "Root",
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 0,
    metadata: {}
  },
  {
    id: "child",
    projectId: "p",
    parentId: "root",
    type: "aspect",
    slug: "child",
    path: "root.child",
    title: "Child",
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 1,
    metadata: {}
  }
];

const relations: ProjectRelation[] = [
  {
    id: "rel_1",
    projectId: "p",
    sourceNodeId: "root",
    targetNodeId: "child",
    type: "contains",
    label: null,
    metadata: {}
  }
];

describe("relations", () => {
  it("validates relation endpoints", () => {
    expect(
      validateRelation(
        {
          sourceNodeId: "missing",
          targetNodeId: "root",
          type: "depends_on"
        },
        nodes
      )
    ).toContain("Source node does not exist.");
  });

  it("returns scoped graph nodes and internal relations", () => {
    const graph = scopedGraph("root", nodes, relations);
    expect(graph.nodes.map((node) => node.id)).toContain("child");
    expect(graph.relations.every((relation) => graph.nodes.some((node) => node.id === relation.sourceNodeId))).toBe(true);
  });
});

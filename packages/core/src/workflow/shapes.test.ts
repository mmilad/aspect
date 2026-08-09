import { describe, expect, it } from "vitest";
import { exampleWorkflowGraph, parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "./schema";
import {
  bagViewAtNode,
  deriveMapOutputShape,
  inferNodeOutputShapes,
  listShapePaths,
  serializeBagViewSlim,
  serializeShapeSlim,
  slimShapesForReads,
  validateValueAgainstShape
} from "./shapes";

describe("workflow bag shapes", () => {
  it("defaults context load writes to Entity[]", () => {
    const load = exampleWorkflowGraph.nodes.find((node) => node.id === "load");
    expect(load).toBeTruthy();
    if (!load) {
      return;
    }
    const shapes = inferNodeOutputShapes(load);
    expect(serializeShapeSlim(shapes.matches)).toBe("Entity[]");
  });

  it("propagates Entity item into foreach item binding", () => {
    const graph = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        {
          id: "load",
          type: "context",
          position: { x: 100, y: 0 },
          data: {
            title: "Load",
            writes: ["matches"],
            auto: { loadContext: { queryFrom: "goal", limit: 5 } }
          }
        },
        {
          id: "each",
          type: "foreach",
          position: { x: 200, y: 0 },
          data: {
            title: "Each",
            foreach: {
              itemsFrom: "matches",
              body: { type: "subworkflow", workflowId: "child" },
              failureMode: "fail"
            }
          }
        },
        { id: "end", type: "end", position: { x: 300, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "load", kind: "next" },
        { id: "e2", source: "load", target: "each", kind: "next" },
        { id: "e3", source: "each", target: "end", kind: "next" }
      ]
    });
    expect(graph.ok).toBe(true);
    if (!graph.ok) {
      return;
    }
    const view = bagViewAtNode(graph.graph, "each");
    expect(serializeShapeSlim(view.matches)).toBe("Entity[]");
    expect(serializeShapeSlim(view.item)).toBe("Entity");
    expect(listShapePaths(view.item)).toEqual(
      expect.arrayContaining(["id", "type", "title", "status", "summary"])
    );
  });

  it("derives map output shape from field projection", () => {
    const shape = deriveMapOutputShape(
      {
        from: "matches",
        as: "slim",
        mode: "array",
        fields: [
          { from: "id", as: "id" },
          { from: "title", as: "name" }
        ]
      },
      { kind: "array", items: { kind: "ref", ref: "Entity" } }
    );
    expect(serializeShapeSlim(shape)).toBe("object{id,name}[]");
  });

  it("serializes slim bag views for AI", () => {
    const view = bagViewAtNode(exampleWorkflowGraph, "choose");
    const slim = serializeBagViewSlim(view);
    expect(slim.keys.matches).toBe("Entity[]");
    expect(slim.keys.filteredEntities).toBe("Entity[]");
    const reads = slimShapesForReads(exampleWorkflowGraph, "choose", ["goal", "filteredEntities"]);
    expect(reads.keys).toEqual({
      goal: "string",
      filteredEntities: "Entity[]"
    });
  });

  it("validateValueAgainstShape checks primitives and arrays", () => {
    expect(validateValueAgainstShape("ok", { kind: "primitive", type: "string" }).ok).toBe(true);
    expect(validateValueAgainstShape(1, { kind: "primitive", type: "string" }).ok).toBe(false);
    expect(
      validateValueAgainstShape(["a", "b"], {
        kind: "array",
        items: { kind: "primitive", type: "string" }
      }).ok
    ).toBe(true);
    expect(
      validateValueAgainstShape(["a", 2], {
        kind: "array",
        items: { kind: "primitive", type: "string" }
      }).ok
    ).toBe(false);
  });
});

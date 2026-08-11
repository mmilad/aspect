import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNodeModel } from "./nodes/registry";
import { emptyWorkflowGraph, parseWorkflowGraph } from "./schema";
import { inferNodeOutputShapes, serializeShapeSlim } from "./shapes";

describe("start node run inputs", () => {
  it("defaults goal as an optional string run input", () => {
    const data = getNodeModel("start").defaultData();
    assert.deepEqual(data.writes, ["goal"]);
    assert.equal(data.outputContracts?.goal?.required, false);
    assert.equal(serializeShapeSlim(data.outputContracts!.goal!.shape!), "string");
  });

  it("infers shapes from Start outputContracts", () => {
    const graph = emptyWorkflowGraph();
    const start = graph.nodes.find((node) => node.type === "start")!;
    start.data = {
      title: "Start",
      writes: ["goal", "limit"],
      writeBindings: { goal: "goal", limit: "limit" },
      outputContracts: {
        goal: { required: true, shape: { kind: "primitive", type: "string" } },
        limit: { required: false, shape: { kind: "primitive", type: "number" } }
      }
    };
    const shapes = inferNodeOutputShapes(start);
    assert.equal(serializeShapeSlim(shapes.goal!), "string");
    assert.equal(serializeShapeSlim(shapes.limit!), "number");
  });

  it("rejects Start with incoming edges", () => {
    const parsed = parseWorkflowGraph({
      version: emptyWorkflowGraph().version,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start", writes: ["goal"] } },
        { id: "end", type: "end", position: { x: 100, y: 0 }, data: { title: "End" } },
        { id: "other", type: "transform", position: { x: 50, y: 50 }, data: { title: "T", reads: [], writes: [] } }
      ],
      edges: [
        { id: "e1", source: "other", target: "start", kind: "next" },
        { id: "e2", source: "start", target: "end", kind: "next" }
      ]
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.ok(parsed.errors.some((error) => /must not have incoming edges/i.test(error)));
    }
  });
});

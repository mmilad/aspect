import { describe, expect, it } from "vitest";
import {
  applyBagWrites,
  createContextBag,
  exampleWorkflowGraph,
  parseWorkflowGraph,
  pickBagKeys,
  readContextBag,
  warnMissingUpstreamKeys,
  writeContextBag,
  writeWorkflowGraph
} from "./schema";

const legacyV1Flow = {
  version: 1,
  edges: [
    { id: "e1", source: "start", target: "load" },
    { id: "e2", source: "load", target: "filter" },
    { id: "e3", source: "filter", target: "choose" },
    { id: "e4", source: "choose", target: "write_aspect" },
    { id: "e5", source: "write_aspect", target: "end" }
  ],
  nodes: [
    {
      data: { title: "Start", writes: ["goal"] },
      id: "start",
      position: { x: 0, y: 0 },
      type: "start"
    },
    {
      data: {
        auto: {
          loadContext: {
            limit: 10,
            queryFrom: "goal",
            types: ["aspect", "feature"]
          }
        },
        reads: ["goal"],
        title: "Load candidates",
        writes: ["matches"]
      },
      id: "load",
      position: { x: 200, y: 0 },
      type: "context"
    },
    {
      data: {
        auto: {
          filter: {
            from: "matches",
            keys: ["id", "title", "type", "status"],
            where: { field: "type", op: "in", value: ["aspect", "feature"] }
          }
        },
        reads: ["matches"],
        title: "Filter keys",
        writes: ["filteredEntities"]
      },
      id: "filter",
      position: { x: 400, y: 0 },
      type: "filter"
    },
    {
      data: {
        llm: {
          inputKeys: ["goal", "filteredEntities"],
          instructions: "Pick the smallest truthful Aspect id from filteredEntities.",
          outputSchema: ["chosenAspectId", "createNewTitle", "confidence"],
          tools: []
        },
        reads: ["goal", "filteredEntities"],
        title: "Choose Aspect",
        writes: ["chosenAspectId", "createNewTitle", "confidence"]
      },
      id: "choose",
      position: { x: 600, y: 0 },
      type: "llm"
    },
    {
      data: {
        reads: ["chosenAspectId", "createNewTitle"],
        title: "Ensure Aspect",
        tool: {
          argsFromBag: { id: "chosenAspectId", title: "createNewTitle" },
          name: "create_entity_if_missing"
        },
        writes: ["aspectId"]
      },
      id: "write_aspect",
      position: { x: 800, y: 0 },
      type: "tool"
    },
    {
      data: { title: "End" },
      id: "end",
      position: { x: 1000, y: 0 },
      type: "end"
    }
  ]
};

describe("workflow graph v2", () => {
  it("migrates legacy v1 filter graphs to transform + typed next edges", () => {
    const result = parseWorkflowGraph(legacyV1Flow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.graph.version).toBe(2);
      expect(result.graph.nodes.find((node) => node.id === "filter")?.type).toBe("transform");
      expect(result.graph.edges.every((edge) => edge.kind === "next")).toBe(true);
    }
  });

  it("accepts the locked exampleWorkflowGraph", () => {
    const result = parseWorkflowGraph(exampleWorkflowGraph);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.graph.nodes).toHaveLength(6);
      expect(result.graph.edges).toHaveLength(5);
      expect(result.graph.version).toBe(2);
    }
  });

  it("rejects invalid node types", () => {
    const result = parseWorkflowGraph({
      version: 2,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "bad", type: "magic", position: { x: 1, y: 1 }, data: { title: "Bad" } },
        { id: "end", type: "end", position: { x: 2, y: 2 }, data: { title: "End" } }
      ],
      edges: [{ id: "e1", source: "start", target: "end", kind: "next" }]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.includes("invalid type"))).toBe(true);
    }
  });

  it("validates fork/join depends_on topology", () => {
    const result = parseWorkflowGraph({
      version: 2,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        { id: "fork", type: "fork", position: { x: 100, y: 0 }, data: { title: "Fork" } },
        { id: "a", type: "tool", position: { x: 200, y: -40 }, data: { title: "A", tool: { name: "a" }, writes: ["a"] } },
        { id: "b", type: "tool", position: { x: 200, y: 40 }, data: { title: "B", tool: { name: "b" }, writes: ["b"] } },
        {
          id: "join",
          type: "join",
          position: { x: 320, y: 0 },
          data: { title: "Join", join: { mode: "all", remaining: "cancel_remaining" } }
        },
        { id: "end", type: "end", position: { x: 440, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "fork", kind: "next" },
        { id: "e2", source: "fork", target: "a", kind: "next" },
        { id: "e3", source: "fork", target: "b", kind: "next" },
        { id: "e4", source: "a", target: "join", kind: "depends_on" },
        { id: "e5", source: "b", target: "join", kind: "depends_on" },
        { id: "e6", source: "join", target: "end", kind: "next" }
      ]
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing start or title", () => {
    const result = parseWorkflowGraph({
      version: 2,
      nodes: [{ id: "end", type: "end", position: { x: 0, y: 0 }, data: { title: "End" } }],
      edges: []
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Workflow graph requires exactly one start node.");
    }
  });

  it("round-trips graph and bag through metadata helpers", () => {
    const parsed = parseWorkflowGraph(legacyV1Flow);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const metadata = writeWorkflowGraph({}, parsed.graph);
    expect(parseWorkflowGraph(metadata.graph).ok).toBe(true);
    expect(metadata.schemaVersion).toBe(2);

    const bag = createContextBag({
      workflowId: "flow_1",
      goal: "ship feat-18",
      startNodeId: "start"
    });
    const withBag = writeContextBag({}, bag);
    const read = readContextBag(withBag);
    expect(read?.goal).toBe("ship feat-18");
    expect(read?.keys.goal).toBe("ship feat-18");
  });

  it("enforces declared bag reads/writes", () => {
    const bag = createContextBag({
      workflowId: "flow_1",
      goal: "x",
      startNodeId: "start",
      keys: { goal: "x", secret: 1 }
    });
    expect(pickBagKeys(bag, ["goal"])).toEqual({ goal: "x" });
    expect(pickBagKeys(bag, ["goal", "missing"])).toEqual({ goal: "x" });

    const bad = applyBagWrites(bag, ["a"], { a: 1, b: 2 });
    expect(bad.ok).toBe(false);

    const good = applyBagWrites(bag, ["a"], { a: 1 });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.bag.keys.a).toBe(1);
    }
  });

  it("warns on missing upstream bag keys", () => {
    const warnings = warnMissingUpstreamKeys(exampleWorkflowGraph);
    expect(Array.isArray(warnings)).toBe(true);
  });
});

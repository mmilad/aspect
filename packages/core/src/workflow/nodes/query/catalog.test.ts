import { describe, expect, it } from "vitest";
import { parseWorkflowGraph } from "../../graph";
import { getNodeModel, WORKFLOW_SCHEMA_VERSION } from "../index";
import { pinsForQuery, portsForQuery, QUERY_CATALOG, withQueryConfig } from "./catalog";

describe("query catalog", () => {
  it("lists every op with kind and pins", () => {
    expect(Object.keys(QUERY_CATALOG).sort()).toEqual([
      "create_entity",
      "filter",
      "get",
      "list",
      "neighborhood",
      "next_work",
      "rollup_parent_status",
      "search",
      "update_entity"
    ]);
    expect(QUERY_CATALOG.get.kind).toBe("read");
    expect(QUERY_CATALOG.filter.kind).toBe("filter");
    expect(QUERY_CATALOG.create_entity.kind).toBe("write");
  });

  it("infers get pins", () => {
    const pins = pinsForQuery({ op: "get" });
    expect(pins.inputs.map((pin) => pin.id)).toEqual(["id"]);
    expect(pins.outputs.map((pin) => pin.id)).toEqual(["entity"]);
    expect(pins.outputs[0]?.shape).toEqual({
      kind: "union",
      options: [
        { kind: "ref", ref: "Entity" },
        { kind: "primitive", type: "null" }
      ]
    });
  });

  it("list with no slots has no input pins", () => {
    const ports = portsForQuery({ op: "list", type: "aspect" });
    expect(Object.keys(ports.inputs)).toEqual([]);
    expect(Object.keys(ports.outputContracts)).toEqual(["entities"]);
    expect(ports.outputContracts.entities?.required).toBe(true);
  });

  it("list with only a const key slot emits no relatedTo or q pins", () => {
    const pins = pinsForQuery({
      op: "list",
      slots: [{ id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "FEAT-18" }]
    });
    expect(pins.inputs.map((pin) => pin.id)).toEqual([]);
    expect(pins.outputs.map((pin) => pin.id)).toEqual(["entities"]);
  });

  it("list pin key with a default is optional", () => {
    const pins = pinsForQuery({
      op: "list",
      slots: [{ id: "key", slot: "field", field: "key", op: "eq", source: "pin", value: "FEAT-18" }]
    });
    expect(pins.inputs).toEqual([
      { id: "key", required: false, shape: { kind: "primitive", type: "string" } }
    ]);
  });

  it("emits only pin-source slots plus outputs", () => {
    const pins = pinsForQuery({
      op: "list",
      slots: [
        { id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "FEAT-18" },
        { id: "relatedTo", slot: "relatedTo", source: "pin" }
      ]
    });
    expect(pins.inputs.map((pin) => pin.id)).toEqual(["relatedTo"]);
    expect(pins.inputs[0]?.required).toBe(false);
  });

  it("adds priority when create_entity type is task", () => {
    const aspect = pinsForQuery({ op: "create_entity", type: "aspect" }).inputs.map((pin) => pin.id);
    const task = pinsForQuery({ op: "create_entity", type: "task" }).inputs.map((pin) => pin.id);
    expect(aspect).not.toContain("priority");
    expect(task).toContain("priority");
  });

  it("drops vanished bindings when op changes", () => {
    const start = withQueryConfig(
      {
        title: "Query",
        query: {
          op: "list",
          slots: [
            { id: "relatedTo", slot: "relatedTo", source: "pin" },
            { id: "q", slot: "q", source: "pin" }
          ]
        },
        inputBindings: { relatedTo: "scopeId", q: "search" },
        writeBindings: { entities: "rows" }
      },
      {
        op: "list",
        slots: [
          { id: "relatedTo", slot: "relatedTo", source: "pin" },
          { id: "q", slot: "q", source: "pin" }
        ]
      }
    );
    const next = withQueryConfig(start, { op: "get" });
    expect(Object.keys(next.inputs ?? {})).toEqual(["id"]);
    expect(next.inputBindings).toBeUndefined();
    expect(next.writeBindings).toBeUndefined();
    expect(Object.keys(next.outputContracts ?? {})).toEqual(["entity"]);
  });
});

describe("query parse materializes ports", () => {
  it("fills dataInputs without authored reads", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "lookup",
          type: "query",
          position: { x: 200, y: 0 },
          data: { title: "Lookup", query: { op: "get" } }
        },
        { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "lookup", kind: "next" },
        { id: "e2", source: "lookup", target: "end", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.errors.join("\n"));
    }
    const node = parsed.graph.nodes.find((item) => item.id === "lookup");
    expect(node?.data.inputs).toMatchObject({
      id: { required: true, shape: { kind: "primitive", type: "string" } }
    });
    expect(getNodeModel("query").dataInputs?.(node!)).toEqual(["id"]);
    expect(getNodeModel("query").dataOutputs?.(node!)).toEqual(["entity"]);
  });

  it("parses a const-only list without relatedTo or q inputs", () => {
    const parsed = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "list",
          type: "query",
          position: { x: 200, y: 0 },
          data: {
            title: "List",
            query: {
              op: "list",
              slots: [{ id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "FEAT-18" }]
            }
          }
        },
        { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "list", kind: "next" },
        { id: "e2", source: "list", target: "end", kind: "next" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.errors.join("\n"));
    }
    const node = parsed.graph.nodes.find((item) => item.id === "list");
    expect(node?.data.inputs).toEqual({});
    expect(node?.data.query?.slots).toEqual([
      { id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "FEAT-18" }
    ]);
    expect(getNodeModel("query").dataInputs?.(node!)).toEqual([]);
  });
});

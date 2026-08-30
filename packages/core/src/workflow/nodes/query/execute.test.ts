import { describe, expect, it } from "vitest";
import type { Entity, EntityRelation } from "../../../domain/types";
import { parseWorkflowGraph, type WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { WorkflowRun } from "../../runtime";
import type { WorkflowAdapters } from "../../runtime/adapters";

const STRING = { kind: "primitive" as const, type: "string" as const };
const ENTITY = { kind: "ref" as const, ref: "Entity" };
const ENTITIES = { kind: "array" as const, items: ENTITY };
const NULLABLE_ENTITY = {
  kind: "union" as const,
  options: [ENTITY, { kind: "primitive" as const, type: "null" as const }]
};

function entity(partial: Partial<Entity> & Pick<Entity, "id" | "type" | "title">): Entity {
  return {
    projectId: "project_test",
    key: null,
    slug: partial.id,
    summary: "",
    body: "",
    status: "planned",
    sortOrder: 0,
    metadata: {},
    ...partial
  };
}

function parsed(raw: unknown): WorkflowGraph {
  const result = parseWorkflowGraph(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.graph;
}

function edge(
  id: string,
  source: string,
  sourcePin: string,
  target: string,
  targetPin: string,
  kind: "next" | "data" = "data"
) {
  return { id, source, target, kind, sourcePin, targetPin };
}

function queryGraph(input: {
  query: Record<string, unknown>;
  variables: Array<{ name: string; role: "input" | "output"; shape: unknown; required?: boolean }>;
  inPins: Array<{ from: string; to: string }>;
  outPins: Array<{ from: string; to: string }>;
}): WorkflowGraph {
  return parsed({
    version: WORKFLOW_SCHEMA_VERSION,
    variables: input.variables,
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
      {
        id: "query",
        type: "query",
        position: { x: 200, y: 0 },
        data: { title: "Query", query: input.query }
      },
      { id: "end", type: "end", position: { x: 400, y: 0 }, data: { title: "End" } }
    ],
    edges: [
      edge("e_start", "start", "then", "query", "in", "next"),
      edge("e_end", "query", "then", "end", "in", "next"),
      ...input.inPins.map((pin, index) =>
        edge(`d_in_${index}`, "start", pin.from, "query", pin.to)
      ),
      ...input.outPins.map((pin, index) =>
        edge(`d_out_${index}`, "query", pin.from, "end", pin.to)
      )
    ]
  });
}

async function runGraph(
  graph: WorkflowGraph,
  keys: Record<string, unknown>,
  options?: { adapters?: WorkflowAdapters; entities?: Entity[]; relations?: EntityRelation[] }
) {
  const run = new WorkflowRun({
    graph,
    bag: {
      workflowId: "query_test",
      cursor: "start",
      goal: "query test",
      keys,
      status: "running"
    },
    adapters: options?.adapters,
    entities: options?.entities,
    relations: options?.relations
  });
  return run.runUntilPause();
}

describe("query execution", () => {
  it("gets an entity through the adapter", async () => {
    const aspect = entity({ id: "aspect_a", type: "aspect", title: "Alpha" });
    const graph = queryGraph({
      query: { op: "get" },
      variables: [
        { name: "targetId", role: "input", shape: STRING, required: true },
        { name: "found", role: "output", shape: NULLABLE_ENTITY, required: true }
      ],
      inPins: [{ from: "targetId", to: "id" }],
      outPins: [{ from: "entity", to: "found" }]
    });
    const result = await runGraph(graph, { targetId: "aspect_a" }, {
      adapters: { getEntity: async (id) => (id === aspect.id ? aspect : null) }
    });
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.found).toMatchObject({ id: "aspect_a", title: "Alpha" });
  });

  it("lists through the adapter and keeps optional pins unbound", async () => {
    const rows = [
      entity({ id: "aspect_a", type: "aspect", title: "Alpha" }),
      entity({ id: "aspect_b", type: "aspect", title: "Beta" })
    ];
    const graph = queryGraph({
      query: { op: "list", type: "aspect" },
      variables: [{ name: "entities", role: "output", shape: ENTITIES, required: true }],
      inPins: [],
      outPins: [{ from: "entities", to: "entities" }]
    });
    const result = await runGraph(graph, {}, {
      adapters: {
        listEntities: async () => rows
      }
    });
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.entities).toHaveLength(2);
  });

  it("does not hardcode PLAN when listing through the adapter", async () => {
    const rows = [entity({ id: "aspect_a", type: "aspect", title: "Alpha" })];
    const graph = queryGraph({
      query: { op: "list", type: "aspect" },
      variables: [{ name: "entities", role: "output", shape: ENTITIES, required: true }],
      inPins: [],
      outPins: [{ from: "entities", to: "entities" }]
    });
    const result = await runGraph(graph, {}, {
      adapters: {
        listEntities: async (query) => {
          expect(query.projectKey).toBeUndefined();
          return rows;
        }
      }
    });
    expect(result.kind).toBe("completed");
  });

  it("lists with only a const key eq slot", async () => {
    const rows = [
      entity({ id: "feat_a", type: "feature", title: "A", key: "FEAT-18" }),
      entity({ id: "feat_b", type: "feature", title: "B", key: "FEAT-19" })
    ];
    const graph = queryGraph({
      query: {
        op: "list",
        slots: [{ id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "FEAT-18" }]
      },
      variables: [{ name: "entities", role: "output", shape: ENTITIES, required: true }],
      inPins: [],
      outPins: [{ from: "entities", to: "entities" }]
    });
    const result = await runGraph(graph, {}, { entities: rows });
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.entities).toEqual([
      expect.objectContaining({ id: "feat_a", key: "FEAT-18" })
    ]);
  });

  it("uses a defaulted unwired pin slot", async () => {
    const rows = [
      entity({ id: "feat_a", type: "feature", title: "A", key: "FEAT-18" }),
      entity({ id: "feat_b", type: "feature", title: "B", key: "FEAT-19" })
    ];
    const graph = queryGraph({
      query: {
        op: "list",
        slots: [{ id: "key", slot: "field", field: "key", op: "eq", source: "pin", value: "FEAT-18" }]
      },
      variables: [{ name: "entities", role: "output", shape: ENTITIES, required: true }],
      inPins: [],
      outPins: [{ from: "entities", to: "entities" }]
    });
    const result = await runGraph(graph, {}, { entities: rows });
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.entities).toEqual([
      expect.objectContaining({ id: "feat_a", key: "FEAT-18" })
    ]);
  });

  it("ANDs a const key slot with a relatedTo pin", async () => {
    const scope = entity({ id: "aspect_scope", type: "aspect", title: "Scope" });
    const match = entity({ id: "feat_a", type: "feature", title: "A", key: "FEAT-18" });
    const sameKey = entity({ id: "feat_b", type: "feature", title: "B", key: "FEAT-18" });
    const otherKey = entity({ id: "feat_c", type: "feature", title: "C", key: "FEAT-19" });
    const graph = queryGraph({
      query: {
        op: "list",
        slots: [
          { id: "key", slot: "field", field: "key", op: "eq", source: "const", value: "FEAT-18" },
          { id: "relatedTo", slot: "relatedTo", source: "pin" }
        ]
      },
      variables: [
        { name: "scopeId", role: "input", shape: STRING, required: true },
        { name: "entities", role: "output", shape: ENTITIES, required: true }
      ],
      inPins: [{ from: "scopeId", to: "relatedTo" }],
      outPins: [{ from: "entities", to: "entities" }]
    });
    const result = await runGraph(
      graph,
      { scopeId: scope.id },
      {
        entities: [scope, match, sameKey, otherKey],
        relations: [
          {
            id: "rel_1",
            projectId: "project_test",
            sourceEntityId: match.id,
            targetEntityId: scope.id,
            type: "implements",
            label: null,
            isPrimary: false,
            metadata: {}
          }
        ]
      }
    );
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.entities).toEqual([
      expect.objectContaining({ id: "feat_a", key: "FEAT-18" })
    ]);
  });

  it("filters an in-bag entity array", async () => {
    const rows = [
      entity({ id: "aspect_a", type: "aspect", title: "Alpha", status: "planned" }),
      entity({ id: "task_a", type: "task", title: "Do it", status: "in_progress" })
    ];
    const graph = queryGraph({
      query: { op: "filter", type: "task" },
      variables: [
        { name: "pool", role: "input", shape: ENTITIES, required: true },
        { name: "entities", role: "output", shape: ENTITIES, required: true }
      ],
      inPins: [{ from: "pool", to: "from" }],
      outPins: [{ from: "entities", to: "entities" }]
    });
    const result = await runGraph(graph, { pool: rows });
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.entities).toEqual([
      expect.objectContaining({ id: "task_a", type: "task" })
    ]);
  });

  it("creates an entity through runWrite", async () => {
    const graph = queryGraph({
      query: { op: "create_entity", type: "aspect" },
      variables: [
        { name: "title", role: "input", shape: STRING, required: true },
        { name: "reason", role: "input", shape: STRING, required: true },
        { name: "entityId", role: "output", shape: STRING, required: true }
      ],
      inPins: [
        { from: "title", to: "title" },
        { from: "reason", to: "reason" }
      ],
      outPins: [{ from: "entityId", to: "entityId" }]
    });
    const result = await runGraph(
      graph,
      { title: "New aspect", reason: "query create test" },
      {
        adapters: {
          runWrite: async (call) => {
            expect(call.action).toBe("create_entity");
            expect(call.args).toMatchObject({ title: "New aspect", type: "aspect" });
            return { values: { entityId: "aspect_new" } };
          }
        }
      }
    );
    expect(result.kind).toBe("completed");
    expect(result.bag.frame?.outputs.entityId).toBe("aspect_new");
  });
});

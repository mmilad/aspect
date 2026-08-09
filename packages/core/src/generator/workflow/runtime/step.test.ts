import { describe, expect, it } from "vitest";
import type { Entity } from "../../../domain/types";
import { createContextBag, parseWorkflowGraph } from "../../../workflow";
import { runWorkflowUntilPause, stepWorkflow } from "./step";

const exampleFlow = {
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

describe("workflow runtime", () => {
  it("runs deterministic nodes then pauses at LLM with declared reads only", async () => {
    const parsed = parseWorkflowGraph(exampleFlow);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const entities = [
      entity({ id: "aspect_workspace", type: "aspect", title: "Should have Project Workspace", status: "in_progress" }),
      entity({ id: "feature_sidebar", type: "feature", title: "Project Sidebar", status: "planned" }),
      entity({ id: "task_noise", type: "task", title: "Unrelated task", status: "planned" })
    ];

    const bag = createContextBag({
      workflowId: "flow_example",
      goal: "workspace sidebar",
      startNodeId: "start"
    });

    const paused = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag,
      entities
    });

    expect(paused.kind).toBe("pending_llm");
    expect(paused.llm?.instructions).toContain("Pick the smallest truthful Aspect");
    expect(paused.llm?.systemPrompt).toContain("careful assistant in Projectplaner");
    expect(paused.llm?.reads).toHaveProperty("goal", "workspace sidebar");
    expect(paused.llm?.reads).toHaveProperty("filteredEntities");
    expect(paused.llm?.reads).not.toHaveProperty("matches");
    expect(Array.isArray(paused.llm?.reads.filteredEntities)).toBe(true);
    const filtered = paused.llm?.reads.filteredEntities as Array<{ id: string; type: string }>;
    expect(filtered.every((item) => item.type === "aspect" || item.type === "feature")).toBe(true);
    expect(filtered.some((item) => item.id === "task_noise")).toBe(false);
  });

  it("completes after LLM writes and mocked tool", async () => {
    const parsed = parseWorkflowGraph(exampleFlow);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_example",
      goal: "workspace",
      startNodeId: "start"
    });

    const entities = [
      entity({ id: "aspect_workspace", type: "aspect", title: "Should have Project Workspace" })
    ];

    const paused = await runWorkflowUntilPause({ graph: parsed.graph, bag, entities });
    expect(paused.kind).toBe("pending_llm");

    const afterLlm = await stepWorkflow({
      graph: parsed.graph,
      bag: paused.bag,
      llmWrites: {
        chosenAspectId: "aspect_workspace",
        createNewTitle: "",
        confidence: "0.9"
      }
    });
    expect(afterLlm.kind).toBe("advanced");
    expect(afterLlm.bag.cursor).toBe("write_aspect");

    const afterTool = await stepWorkflow({
      graph: parsed.graph,
      bag: afterLlm.bag,
      adapters: {
        runTool: ({ name, args }) => {
          expect(name).toBe("create_entity_if_missing");
          expect(args.id).toBe("aspect_workspace");
          return { values: { aspectId: String(args.id) } };
        }
      }
    });
    expect(afterTool.kind).toBe("advanced");
    expect(afterTool.bag.keys.aspectId).toBe("aspect_workspace");

    const done = await stepWorkflow({
      graph: parsed.graph,
      bag: afterTool.bag
    });
    expect(done.kind).toBe("completed");
    expect(done.bag.status).toBe("completed");
  });

  it("fails when tool writes undeclared keys instead of dumping chat", async () => {
    const parsed = parseWorkflowGraph({
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "tool",
          type: "tool",
          position: { x: 1, y: 0 },
          data: { title: "Tool", tool: { name: "x" }, writes: ["ok"] }
        },
        { id: "end", type: "end", position: { x: 2, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "tool" },
        { id: "e2", source: "tool", target: "end" }
      ]
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    let bag = createContextBag({ workflowId: "f", goal: "g", startNodeId: "start" });
    const start = await stepWorkflow({ graph: parsed.graph, bag });
    bag = start.bag;

    const failed = await stepWorkflow({
      graph: parsed.graph,
      bag,
      adapters: {
        runTool: () => ({ values: { ok: 1, leaked: "nope" } })
      }
    });
    expect(failed.kind).toBe("failed");
    expect(failed.message).toMatch(/Undeclared write key/);
  });

  it("runs newTaskWorkflowGraph: load all → rank → pick → prompt → llm", async () => {
    const { newTaskWorkflowGraph } = await import("../../../workflow");
    const parsed = parseWorkflowGraph(newTaskWorkflowGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const aspect = entity({ id: "aspect_1", type: "aspect", title: "Workspace", status: "planned" });
    const top = entity({
      id: "task_top",
      type: "task",
      title: "High priority open",
      key: "PLAN-100",
      status: "planned",
      metadata: { priority: "critical" },
      summary: "Do this first"
    });
    const blocked = entity({
      id: "task_blocked",
      type: "task",
      title: "Waiting",
      status: "planned",
      metadata: { priority: "critical" }
    });
    const canceled = entity({
      id: "task_canceled",
      type: "task",
      title: "Fallen branch",
      status: "planned",
      metadata: { priority: "critical", disabled: true }
    });
    const low = entity({
      id: "task_low",
      type: "task",
      title: "Later",
      status: "planned",
      metadata: { priority: "low" }
    });
    const entities = [aspect, top, blocked, canceled, low];
    const relations = [
      {
        id: "r1",
        projectId: "project_test",
        sourceEntityId: "task_blocked",
        targetEntityId: "aspect_1",
        type: "blocked_by" as const,
        label: null,
        isPrimary: false,
        metadata: {}
      },
      {
        id: "r2",
        projectId: "project_test",
        sourceEntityId: "task_top",
        targetEntityId: "aspect_1",
        type: "affects" as const,
        label: null,
        isPrimary: true,
        metadata: {}
      }
    ];

    const bag = createContextBag({
      workflowId: "flow_new_task",
      goal: "pick next work",
      startNodeId: "start"
    });

    const paused = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag,
      entities,
      relations
    });

    expect(paused.kind).toBe("pending_llm");
    expect(paused.bag.keys.hasCandidates).toBe(true);
    expect((paused.bag.keys.selectedTask as { id: string }).id).toBe("task_top");
    expect(String(paused.bag.keys.agentPrompt)).toContain("PLAN-100");
    expect(String(paused.bag.keys.agentPrompt)).toContain("High priority open");
    expect(paused.llm?.reads).toHaveProperty("agentPrompt");
    expect(Array.isArray(paused.bag.keys.candidates)).toBe(true);
    const candidates = paused.bag.keys.candidates as Array<{ id: string }>;
    expect(candidates.map((item) => item.id)).toEqual(["task_top", "task_low"]);
  });

  it("applies custom systemPrompt with bag templates on pending_llm", async () => {
    const graph = {
      version: 2,
      nodes: [
        {
          id: "start",
          type: "start" as const,
          position: { x: 0, y: 0 },
          data: { title: "Start", writes: ["goal"] }
        },
        {
          id: "decide",
          type: "llm" as const,
          position: { x: 200, y: 0 },
          data: {
            title: "Decide",
            reads: ["goal"],
            writes: ["answer"],
            llm: {
              systemPrompt: "Stay on topic for: {{goal}}",
              instructions: "Write key answer for {{goal}}.",
              inputKeys: ["goal"],
              outputSchema: ["answer"],
              tools: []
            }
          }
        },
        {
          id: "end",
          type: "end" as const,
          position: { x: 400, y: 0 },
          data: { title: "End" }
        }
      ],
      edges: [
        { id: "e1", source: "start", target: "decide", kind: "next" as const },
        { id: "e2", source: "decide", target: "end", kind: "next" as const }
      ]
    };

    const parsed = parseWorkflowGraph(graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const paused = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "flow_sys",
        goal: "rollups",
        startNodeId: "start"
      })
    });

    expect(paused.kind).toBe("pending_llm");
    expect(paused.llm?.systemPrompt).toBe("Stay on topic for: rollups");
    expect(paused.llm?.instructions).toContain("rollups");
  });
});

import { describe, expect, it } from "vitest";
import type { Entity } from "../../../domain/types";
import { createContextBag, parseWorkflowGraph } from "../../../workflow";
import { ensureAspectPreset } from "../../../workflow/presets";
import { adaptersFromRegistry, createFunctionRegistry } from "./adapters";
import { runWorkflowUntilPause, stepWorkflow } from "./step";

function aspect(partial: Partial<Entity> & Pick<Entity, "id" | "title">): Entity {
  return {
    projectId: "project_test",
    key: null,
    slug: partial.id,
    summary: partial.summary ?? "",
    body: "",
    status: "planned",
    sortOrder: 0,
    metadata: {},
    type: "aspect",
    ...partial
  };
}

describe("ensure_aspect runtime mapping", () => {
  it("runs start→load→map then pauses on LLM", async () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const entities = [
      aspect({
        id: "aspect_existing",
        title: "Should author executable workflow step graphs",
        summary: "Executable workflow diagrams."
      }),
      aspect({
        id: "aspect_other",
        title: "Should have Application Shell",
        summary: "Local application shell."
      })
    ];

    const bag = createContextBag({
      workflowId: "wf_ensure",
      goal: "Ensure Aspect",
      startNodeId: "start",
      keys: {
        title: "Should discover and run workflow presets from MCP",
        summary: "Agents invoke seeded packs by presetKey.",
        reason: "Testing ensure_aspect runtime path."
      }
    });

    const paused = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag,
      entities
    });

    if (paused.kind !== "pending_llm") {
      throw new Error(`expected pending_llm, got ${paused.kind}: ${paused.message ?? paused.bag.error}`);
    }
    expect(paused.nodeId).toBe("decide");
    expect(paused.llm?.outputSchema).toEqual(["aspectId", "createNew", "confidence"]);
    expect(Array.isArray(paused.bag.keys.candidates)).toBe(true);
    const candidates = paused.bag.keys.candidates as Array<{ id: string; title: string }>;
    expect(candidates.some((item) => item.id === "aspect_existing")).toBe(true);
    expect(candidates[0]).toMatchObject({ id: expect.any(String), title: expect.any(String) });
    expect(candidates[0]).not.toHaveProperty("body");
  });

  it("routes createNew=false to end_reuse without write", async () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const entities = [
      aspect({
        id: "aspect_author",
        title: "Should author executable workflow step graphs",
        summary: "Executable workflow diagrams."
      })
    ];

    let bag = createContextBag({
      workflowId: "wf_ensure",
      goal: "Ensure Aspect",
      startNodeId: "start",
      keys: {
        title: "Should author branching workflow diagrams with LLM steps",
        reason: "Reuse stress test."
      }
    });

    let last = await runWorkflowUntilPause({ graph: parsed.graph, bag, entities });
    expect(last.kind).toBe("pending_llm");

    last = await stepWorkflow({
      graph: parsed.graph,
      bag: last.bag,
      entities,
      llmWrites: {
        aspectId: "aspect_author",
        createNew: false,
        confidence: 0.9
      }
    });
    bag = last.bag;

    // After LLM, continue until end (switch → end_reuse)
    last = await runWorkflowUntilPause({ graph: parsed.graph, bag, entities });
    expect(last.kind).toBe("completed");
    expect(last.bag.keys.aspectId).toBe("aspect_author");
    expect(last.bag.keys.createNew).toBe(false);
  });

  it("routes createNew=true through write create_entity", async () => {
    const parsed = parseWorkflowGraph(ensureAspectPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const createdIds: string[] = [];
    const adapters = adaptersFromRegistry(
      createFunctionRegistry({
        create_entity: (args) => {
          expect(args.type).toBe("aspect");
          expect(args.title).toBe("Should discover and run workflow presets from MCP");
          expect(args.reason).toBe("Create path test.");
          const id = "aspect_created_from_write";
          createdIds.push(id);
          return { values: { aspectId: id } };
        }
      })
    );

    let bag = createContextBag({
      workflowId: "wf_ensure",
      goal: "Ensure Aspect",
      startNodeId: "start",
      keys: {
        title: "Should discover and run workflow presets from MCP",
        summary: "MCP run_workflow by presetKey.",
        reason: "Create path test."
      }
    });

    let last = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag,
      entities: [],
      adapters
    });
    expect(last.kind).toBe("pending_llm");

    last = await stepWorkflow({
      graph: parsed.graph,
      bag: last.bag,
      adapters,
      llmWrites: {
        aspectId: null,
        createNew: true,
        confidence: 0.8
      }
    });

    last = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: last.bag,
      adapters,
      entities: []
    });

    expect(last.kind).toBe("completed");
    expect(createdIds).toEqual(["aspect_created_from_write"]);
    expect(last.bag.keys.aspectId).toBe("aspect_created_from_write");
  });
});

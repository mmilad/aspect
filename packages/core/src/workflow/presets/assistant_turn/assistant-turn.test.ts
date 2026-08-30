import { describe, expect, it } from "vitest";
import type { AssistantContextPack, AssistantSession } from "../../../assistant/types";
import { ASSISTANT_CONTEXT_V1_KEY } from "../../llm/llm-json-schemas";
import { runWorkflowUntilPause, stepWorkflow } from "../../runtime";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { assistantTurnGraph } from "./graph";
import { assistantTurnPreset } from "./preset";

function msg(index: number) {
  return {
    id: `msg_${index}`,
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `turn-${index}`,
    createdAt: "2026-08-30T00:00:00.000Z"
  };
}

const session: AssistantSession = {
  messages: Array.from({ length: 8 }, (_, index) => msg(index)),
  summary: { text: "Working on auth" },
  currentTopic: { id: "t_auth", title: "Auth" },
  topics: [{ id: "t_auth", title: "Auth" }],
  context: { projectKey: "PLAN", entityId: "feature_abc" }
};

const fixturePack: AssistantContextPack = {
  summary: { text: "User switched to graph inspect" },
  currentTopic: { id: "t_graph", title: "Graph inspect" },
  topics: [
    { id: "t_auth", title: "Auth" },
    { id: "t_graph", title: "Graph inspect" }
  ],
  context: { projectKey: "PLAN", entityId: "feature_abc" },
  topicChanged: true,
  focus: "entity inspector"
};

describe("assistant_turn preset", () => {
  it("parses as session → window → Turn A JSON → Turn B text", () => {
    const parsed = parseWorkflowGraph(assistantTurnGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    expect(assistantTurnPreset.presetKey).toBe("assistant_turn");
    expect(assistantTurnPreset.kind).toBe("user");
    expect(assistantTurnPreset.drainLlm).toBe(true);

    const ids = assistantTurnGraph.nodes.map((node) => `${node.id}:${node.type}`);
    expect(ids).toEqual([
      "start:start",
      "r_session:reroute",
      "r_message:reroute",
      "r_pack:reroute",
      "session_read:assistant_session",
      "window:assistant_window",
      "llm_context:llm",
      "llm_reply:llm",
      "end:end"
    ]);

    const turnA = assistantTurnGraph.nodes.find((node) => node.id === "llm_context");
    expect(turnA?.data.llm?.schemaKey).toBe(ASSISTANT_CONTEXT_V1_KEY);
    expect(turnA?.data.llm?.instructions).toContain("{{priorCurrentTopic}}");
    expect(turnA?.data.llm?.instructions).toContain("{{recentTurns}}");
    expect(turnA?.data.llm?.systemPrompt).toContain("topicChanged");

    const turnB = assistantTurnGraph.nodes.find((node) => node.id === "llm_reply");
    expect(turnB?.data.llm?.format).toBe("text");
    expect(turnB?.data.llm?.schemaKey).toBeUndefined();
    expect(turnB?.data.llm?.instructions).toContain("{{contextPack}}");
    expect(turnB?.data.llm?.instructions).toContain("{{message}}");
    expect(turnB?.data.llm?.instructions).not.toContain("{{recentTurns}}");
    expect(turnB?.data.llm?.instructions).not.toContain("{{priorCurrentTopic}}");
  });

  it("pauses Turn A with prior currentTopic and recentTurns, then Turn B with pack + message", async () => {
    const parsed = parseWorkflowGraph(assistantTurnGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_assistant_turn",
      goal: "assistant turn",
      startNodeId: "start",
      keys: {
        session,
        message: "Let's look at the graph instead",
        windowSize: 5
      }
    });

    const first = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(first.kind).toBe("pending_llm");
    expect(first.nodeId).toBe("llm_context");
    expect(first.llm?.schemaKey).toBe(ASSISTANT_CONTEXT_V1_KEY);
    expect(first.llm?.format).toBe("json_schema");
    expect(first.llm?.reads.priorCurrentTopic).toEqual({ id: "t_auth", title: "Auth" });
    expect(first.llm?.reads.priorSummary).toEqual({ text: "Working on auth" });
    expect((first.llm?.reads.recentTurns as { content: string }[]).map((item) => item.content)).toEqual([
      "turn-3",
      "turn-4",
      "turn-5",
      "turn-6",
      "turn-7"
    ]);
    expect(first.llm?.instructions).toContain("Auth");
    expect(first.llm?.instructions).toContain("turn-7");
    expect(first.llm?.instructions).not.toContain("turn-0");
    expect(first.llm?.instructions).toContain("Let's look at the graph instead");

    const afterA = await stepWorkflow({
      graph: parsed.graph,
      bag: first.bag,
      llmWrites: { contextPack: fixturePack }
    });
    expect(afterA.kind).toBe("advanced");

    const second = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: afterA.bag
    });
    expect(second.kind).toBe("pending_llm");
    expect(second.nodeId).toBe("llm_reply");
    expect(second.llm?.format).toBe("text");
    expect(second.llm?.schemaKey).toBeUndefined();
    expect(second.llm?.reads.contextPack).toEqual(fixturePack);
    expect(second.llm?.reads.message).toBe("Let's look at the graph instead");
    expect(second.llm?.reads.recentTurns).toBeUndefined();
    expect(second.llm?.instructions).toContain("Graph inspect");
    expect(second.llm?.instructions).toContain("\"topicChanged\":true");
    expect(second.llm?.instructions).toContain("Let's look at the graph instead");
    expect(second.llm?.instructions).not.toContain("turn-0");
    expect(second.llm?.instructions).not.toContain("turn-7");

    const afterB = await stepWorkflow({
      graph: parsed.graph,
      bag: second.bag,
      llmWrites: { reply: "Switching focus to the graph." }
    });
    expect(afterB.kind).toBe("advanced");

    const done = await runWorkflowUntilPause({
      graph: parsed.graph,
      bag: afterB.bag
    });
    expect(done.kind).toBe("completed");
    expect(done.bag.frame?.outputs.reply).toBe("Switching focus to the graph.");
    expect(done.bag.frame?.outputs.contextPack).toEqual(fixturePack);
  });

  it("runs session_read with a missing summary", async () => {
    const parsed = parseWorkflowGraph(assistantTurnGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const bag = createContextBag({
      workflowId: "flow_assistant_turn",
      goal: "assistant turn",
      startNodeId: "start",
      keys: {
        session: {
          messages: [msg(0)],
          topics: [],
          context: { projectKey: "PLAN" }
        },
        message: "hello"
      }
    });

    const first = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(first.kind).toBe("pending_llm");
    expect(first.llm?.reads.priorSummary).toBeUndefined();
    expect(first.llm?.reads.priorTopics).toEqual([]);
    expect(first.llm?.instructions).toContain("Prior summary: (empty)");
  });
});

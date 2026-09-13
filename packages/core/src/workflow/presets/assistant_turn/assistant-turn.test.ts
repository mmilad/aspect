import { describe, expect, it } from "vitest";
import type { AssistantSession } from "../../../assistant/types";
import { ASSISTANT_CONTEXT_V2_KEY, ASSISTANT_ROUTE_V1_KEY } from "../../llm/llm-json-schemas";
import { runWorkflowUntilPause, stepWorkflow } from "../../runtime";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { assistantTurnGraph } from "./graph";
import { assistantTurnPreset } from "./preset";
import { ASSISTANT_ROLE_MANIFEST, serializeAssistantRoleManifest } from "../../../assistant";

const session: AssistantSession = {
  messages: [],
  summary: { text: "Working on auth" },
  topics: [{ id: "t_auth", title: "Auth", status: "active", weight: 1 }],
  questions: [{ id: "q_scope", text: "What is in scope?", status: "open" }],
  context: { projectKey: "PLAN", entityId: "feature_abc" }
};

function initialBag(message = "Which agents exist?") {
  return createContextBag({
    workflowId: "flow_assistant_turn",
    goal: "assistant turn",
    startNodeId: "start",
    keys: { projectKey: "PLAN", session, message }
  });
}

async function reachDecision() {
  const parsed = parseWorkflowGraph(assistantTurnGraph);
  expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));

  let result = await runWorkflowUntilPause({ graph: parsed.graph, bag: initialBag() });
  expect(result.kind).toBe("pending_llm");
  expect(result.nodeId).toBe("llm_context");
  expect(result.llm?.schemaKey).toBe(ASSISTANT_CONTEXT_V2_KEY);

  result = await stepWorkflow({
    graph: parsed.graph,
    bag: result.bag,
    llmWrites: {
      contextPack: {
        summary: { text: "Working on auth" },
        topics: [{ id: "t_auth", title: "Auth", status: "active", weight: 1 }],
        questions: [{ id: "q_scope", text: "What is in scope?", status: "open" }],
        context: { projectKey: "PLAN", entityId: "feature_abc" }
      }
    }
  });
  result = await runWorkflowUntilPause({ graph: parsed.graph, bag: result.bag });
  expect(result.kind).toBe("pending_llm");
  expect(result.nodeId).toBe("llm_decide");
  expect(result.llm?.schemaKey).toBe(ASSISTANT_ROUTE_V1_KEY);
  return { graph: parsed.graph, result };
}

describe("assistant_turn preset", () => {
  it("parses the visible context, decision, retrieval, delegation, and reply loop", () => {
    const parsed = parseWorkflowGraph(assistantTurnGraph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    expect(assistantTurnPreset.presetKey).toBe("assistant_turn");
    expect(assistantTurnPreset.presetVersion).toBe(11);

    const decisionPrompt = String(assistantTurnGraph.nodes.find((node) => node.id === "llm_decide")?.data.llm?.systemPrompt);
    const replyPrompt = String(assistantTurnGraph.nodes.find((node) => node.id === "llm_reply")?.data.llm?.systemPrompt);
    expect(decisionPrompt).toContain(`Assistant role manifest (assistant_role_v1): ${serializeAssistantRoleManifest()}`);
    expect(replyPrompt).toContain(`Assistant role manifest (assistant_role_v1): ${serializeAssistantRoleManifest()}`);
    expect(decisionPrompt).toContain("agentFacts as the evidence for which active agents exist");
    expect(replyPrompt).toContain("retrieved agent facts as the evidence for which agents exist");
    expect(decisionPrompt).toContain(ASSISTANT_ROLE_MANIFEST.restrictions[3]);

    const ids = assistantTurnGraph.nodes.map((node) => `${node.id}:${node.type}`);
    expect(ids).toEqual(expect.arrayContaining([
      "session_read:assistant_session", "llm_context:llm", "llm_decide:llm", "break_decision:break",
      "decision_switch:switch", "lookup_switch:switch", "list_agents:query", "list_files:file_list", "read_file:file_read", "delegate:delegate", "llm_reply:llm"
    ]));
    expect(assistantTurnGraph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "e_context_agents", source: "llm_context", target: "list_agents", kind: "next" }),
      expect.objectContaining({ id: "d_agents_decision", source: "list_agents", target: "llm_decide", targetPin: "agentFacts", kind: "data" }),
      expect.objectContaining({ id: "d_start_knowledge_access", source: "start", target: "search_knowledge", targetPin: "access", kind: "data" })
    ]));

    const decisionBreak = parsed.ok ? parsed.graph.nodes.find((node) => node.id === "break_decision") : undefined;
    expect(decisionBreak?.data.outputContracts?.route?.shape).toEqual({ kind: "primitive", type: "string" });
    expect(decisionBreak?.data.outputContracts?.lookupKind?.shape).toEqual({
      kind: "union",
      options: [{ kind: "primitive", type: "string" }, { kind: "primitive", type: "null" }]
    });
  });

  it("uses a real read query and loops back to the decision node", async () => {
    const { graph, result: decision } = await reachDecision();
    let result = await stepWorkflow({
      graph,
      bag: decision.bag,
      llmWrites: {
        decision: {
          route: "retrieve", reason: "Need the registered agents", question: null,
          lookup: { kind: "agents", query: null, id: null }, lookupKind: "agents", lookupQuery: null, lookupId: null,
          agentId: null, task: null, runId: null, message: null
        }
      }
    });
    result = await runWorkflowUntilPause({ graph, bag: result.bag });
    expect(result.kind).toBe("pending_llm");
    expect(result.nodeId).toBe("llm_decide");
    expect(result.bag.frame?.pins["list_agents::entities"]).toBeDefined();
  });

  it("routes bounded workspace file lookups through read-only file nodes", async () => {
    const { graph, result: decision } = await reachDecision();
    const fileList = async (input: { path?: string }) => {
      expect(input).toEqual({ path: "src" });
      return { entries: [{ path: "src/app.ts", kind: "file" as const, bytes: 12 }] };
    };
    let result = await stepWorkflow({
      graph,
      bag: decision.bag,
      llmWrites: {
        decision: {
          route: "retrieve", reason: "Need the workspace files", question: null,
          lookup: { kind: "files", query: "src", id: null }, lookupKind: "files", lookupQuery: "src", lookupId: null,
          agentId: null, task: null, runId: null, message: null
        }
      },
      adapters: { fileList }
    });
    result = await runWorkflowUntilPause({ graph, bag: result.bag, adapters: { fileList } });
    expect(result.kind).toBe("pending_llm");
    expect(result.nodeId).toBe("llm_decide");
    expect(result.bag.frame?.pins["list_files::entries"]).toEqual([{ path: "src/app.ts", kind: "file", bytes: 12 }]);
  });

  it("supports a grounded clarification branch", async () => {
    const { graph, result: decision } = await reachDecision();
    let result = await stepWorkflow({
      graph,
      bag: decision.bag,
      llmWrites: {
        decision: {
          route: "clarify", reason: "The request is ambiguous", question: "Which project should I inspect?",
          lookup: null, lookupKind: null, lookupQuery: null, lookupId: null,
          agentId: null, task: null, runId: null, message: null
        }
      }
    });
    result = await runWorkflowUntilPause({ graph, bag: result.bag });
    expect(result.kind).toBe("pending_llm");
    expect(result.nodeId).toBe("llm_reply");
    expect(result.llm?.reads.question).toBe("Which project should I inspect?");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Entity } from "../../../domain/types";
import { emptySession } from "../../../assistant";
import {
  assistantContextPackFixture,
  assistantDecisionFixture,
  assistantReplyFixture,
  runAssistantEvaluation
} from "./evaluation";

const codingAgent: Entity = {
  id: "agent_coding",
  projectId: "project_test",
  type: "agent",
  key: null,
  slug: "coding-agent",
  title: "Coding Agent",
  summary: "Builds and tests software.",
  body: "",
  status: "planned",
  sortOrder: 0,
  metadata: { capabilities: ["coding", "testing"] }
};

function base(message: string) {
  return {
    message,
    session: emptySession("PLAN"),
    entities: [codingAgent]
  };
}

describe("deterministic Assistant evaluations", () => {
  it("lists actual active agents before producing a grounded reply and trace", async () => {
    const run = await runAssistantEvaluation({
      id: "list-agents",
      ...base("Which agents exist?"),
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({ route: "reply", reason: "Agent facts are available." }),
        llm_reply: assistantReplyFixture("The project has a Coding Agent.")
      }
    });

    expect(run.result.kind).toBe("completed");
    expect(run.result.bag.frame?.pins["list_agents::entities"]).toEqual([codingAgent]);
    expect(run.result.bag.frame?.outputs.reply).toBe("The project has a Coding Agent.");
    expect(run.trace.route).toBe("reply");
    expect(run.trace.steps.map((step) => step.nodeId)).toEqual([
      "start",
      "session_read",
      "llm_context",
      "list_agents",
      "llm_decide",
      "decision_switch",
      "llm_reply",
      "end"
    ]);
  });

  it("retrieves an individual agent before answering about it", async () => {
    const run = await runAssistantEvaluation({
      id: "get-agent",
      ...base("What can the coding agent do?"),
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: [
          assistantDecisionFixture({
            route: "retrieve",
            reason: "The selected agent profile is needed.",
            lookupKind: "agent",
            lookupId: codingAgent.id
          }),
          assistantDecisionFixture({ route: "reply", reason: "The agent profile is available." })
        ],
        llm_reply: assistantReplyFixture("The Coding Agent builds and tests software.")
      }
    });

    expect(run.result.kind).toBe("completed");
    expect(run.result.bag.frame?.pins["get_agent::entity"]).toEqual(codingAgent);
    expect(run.trace.route).toBe("reply");
    expect(run.trace.steps.some((step) => step.nodeId === "get_agent")).toBe(true);
    expect(run.trace.steps.filter((step) => step.nodeId === "llm_decide")).toHaveLength(2);
  });

  it("retrieves scoped knowledge before answering from project memory", async () => {
    const knowledgeSearch = vi.fn().mockResolvedValue({
      hits: [{
        id: "memory-1",
        datasetKey: "project-plan",
        rawText: "The release target is September.",
        metadata: { source: "project-note" },
        scope: { kind: "project", projectKey: "PLAN" },
        score: 0.91
      }],
      query: "release target",
      embeddingModel: "fixture-embed",
      totalSearched: 1,
      searchMode: "vector"
    });
    const run = await runAssistantEvaluation({
      id: "knowledge-retrieval",
      ...base("What is the release target?"),
      knowledgeDataset: "project-plan",
      adapters: { knowledgeSearch },
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: [
          assistantDecisionFixture({ route: "retrieve", reason: "Project memory is needed.", lookupKind: "knowledge", lookupQuery: "release target" }),
          assistantDecisionFixture({ route: "reply", reason: "A scoped memory hit is available." })
        ],
        llm_reply: assistantReplyFixture("The project note says the release target is September.")
      }
    });

    expect(run.result.kind, run.result.kind === "failed" ? run.result.message : "").toBe("completed");
    expect(knowledgeSearch).toHaveBeenCalledWith({ datasetKey: "project-plan", query: "release target", topK: 10 });
    expect(run.result.bag.frame?.pins["search_knowledge::hits"]).toHaveLength(1);
    expect(run.result.bag.frame?.outputs.reply).toContain("September");
    expect(run.trace.steps.some((step) => step.nodeId === "search_knowledge")).toBe(true);
  });

  it("asks one focused question for an ambiguous request", async () => {
    const question = "Which project should I inspect?";
    const run = await runAssistantEvaluation({
      id: "clarify",
      ...base("Please inspect it."),
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({ route: "clarify", reason: "The target is ambiguous.", question }),
        llm_reply: assistantReplyFixture(question)
      }
    });

    expect(run.result.kind).toBe("completed");
    expect(run.trace.route).toBe("clarify");
    expect((run.result.bag.frame?.pins["break_decision::value"] as { question?: unknown })?.question).toBe(question);
    expect(run.result.bag.frame?.outputs.reply).toBe(question);
  });

  it("keeps unavailable information explicitly uncertain", async () => {
    const reply = "I cannot confirm that information from the available project data.";
    const run = await runAssistantEvaluation({
      id: "uncertain",
      ...base("What is the release date?"),
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({ route: "reply", reason: "No release date is available." }),
        llm_reply: assistantReplyFixture(reply)
      }
    });

    expect(run.result.kind).toBe("completed");
    expect(String(run.result.bag.frame?.outputs.reply)).toContain("cannot confirm");
    expect(run.result.bag.frame?.pins["delegate::delegationResult"]).toBeUndefined();
  });

  it("delegates only through the registered adapter and exposes confirmed results", async () => {
    const runAgent = vi.fn().mockResolvedValue({
      runId: "agent-run-1",
      agentId: codingAgent.id,
      status: "completed",
      result: "The app was implemented."
    });
    const run = await runAssistantEvaluation({
      id: "delegate-success",
      ...base("Delegate this to the coding agent."),
      adapters: { runAgent },
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({
          route: "delegate",
          reason: "The coding agent should perform this work.",
          agentId: codingAgent.id,
          task: "Build the requested app."
        }),
        llm_reply: assistantReplyFixture("The coding agent confirmed: The app was implemented.")
      }
    });

    expect(run.result.kind).toBe("completed");
    expect(runAgent).toHaveBeenCalledWith({
      agentId: codingAgent.id,
      task: "Build the requested app.",
      projectKey: "PLAN"
    });
    expect(run.result.bag.frame?.pins["delegate::delegationStatus"]).toBe("completed");
    expect(run.trace.route).toBe("delegate");
    expect(run.trace.delegation).toEqual({ agentId: codingAgent.id, status: "completed" });
  });

  it("reports failed delegation without claiming success and preserves waiting state for resume", async () => {
    const failed = await runAssistantEvaluation({
      id: "delegate-failed",
      ...base("Delegate this to the coding agent."),
      adapters: {
        runAgent: async () => ({
          runId: "agent-run-failed",
          agentId: codingAgent.id,
          status: "failed",
          error: "The capability is unavailable."
        })
      },
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({
          route: "delegate",
          reason: "The coding agent should perform this work.",
          agentId: codingAgent.id,
          task: "Build the requested app."
        }),
        llm_reply: assistantReplyFixture("The delegation failed; I cannot claim that the work was completed.")
      }
    });

    expect(failed.result.kind).toBe("completed");
    expect(failed.result.bag.frame?.pins["delegate::delegationStatus"]).toBe("failed");
    expect(failed.result.bag.frame?.pins["delegate::delegationError"]).toBe("The capability is unavailable.");
    expect(String(failed.result.bag.frame?.outputs.reply)).toContain("cannot claim");

    const waiting = await runAssistantEvaluation({
      id: "delegate-waiting",
      ...base("Delegate this to the coding agent."),
      adapters: {
        runAgent: async () => ({
          runId: "agent-run-waiting",
          agentId: codingAgent.id,
          status: "waiting",
          question: "Which repository should I use?"
        })
      },
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({
          route: "delegate",
          reason: "The coding agent should perform this work.",
          agentId: codingAgent.id,
          task: "Build the requested app."
        }),
        llm_reply: assistantReplyFixture("The coding agent needs one detail before continuing.")
      }
    });
    expect(waiting.result.kind).toBe("completed");
    expect(waiting.result.bag.frame?.outputs.pendingDelegationOut).toEqual({
      runId: "agent-run-waiting",
      agentId: codingAgent.id,
      task: "Build the requested app.",
      question: "Which repository should I use?"
    });

    const resumeAgent = vi.fn().mockResolvedValue({
      runId: "agent-run-waiting",
      agentId: codingAgent.id,
      status: "completed",
      result: "The repository was inspected."
    });
    const resumed = await runAssistantEvaluation({
      id: "delegate-resume",
      ...base("Use the projectplaner repository."),
      session: {
        ...emptySession("PLAN"),
        pendingDelegation: {
          runId: "agent-run-waiting",
          agentId: codingAgent.id,
          task: "Build the requested app.",
          question: "Which repository should I use?"
        }
      },
      adapters: { resumeAgent },
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({
          route: "resume",
          reason: "A pending delegation can continue.",
          runId: "agent-run-waiting",
          message: "Use the projectplaner repository."
        }),
        llm_reply: assistantReplyFixture("The coding agent confirmed: The repository was inspected.")
      }
    });

    expect(resumed.result.kind).toBe("completed");
    expect(resumeAgent).toHaveBeenCalledWith({
      runId: "agent-run-waiting",
      message: "Use the projectplaner repository.",
      projectKey: "PLAN"
    });
    expect(resumed.result.bag.frame?.pins["delegate::delegationStatus"]).toBe("completed");
  });

  it("fails a retrieval loop at the declared decision visit limit", async () => {
    const decision = assistantDecisionFixture({
      route: "retrieve",
      reason: "More agent facts are needed.",
      lookupKind: "agents"
    });
    const run = await runAssistantEvaluation({
      id: "retrieval-limit",
      ...base("Keep looking."),
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: [decision, decision, decision, decision, decision]
      }
    });

    expect(run.result.kind).toBe("failed");
    expect(run.result.message).toContain("llm_decide");
    expect(run.result.message).toContain("maxVisits");
    expect(run.trace.status).toBe("failed");
    expect(run.trace.steps.filter((step) => step.nodeId === "llm_decide")).toHaveLength(6);
  });

  it("does not mutate the durable session while evaluating a turn", async () => {
    const session = emptySession("PLAN");
    const before = structuredClone(session);
    await runAssistantEvaluation({
      id: "session-immutable",
      ...base("Hello"),
      session,
      llmWrites: {
        llm_context: assistantContextPackFixture(),
        llm_decide: assistantDecisionFixture({ route: "reply", reason: "The context is sufficient." }),
        llm_reply: assistantReplyFixture("Hello.")
      }
    });
    expect(session).toEqual(before);
  });
});

import {
  appendMessage,
  commitAssistantTurn,
  DEFAULT_ASSISTANT_WINDOW_SIZE,
  mergeSession,
  parseContextPack,
  parsePatch
} from "@projectplaner/core/assistant";
import { agentConversation, parseAgentProfile, type AssistantSessionRecord, type WorkflowAgentResult } from "@projectplaner/core";
import type { WorkflowContextBag } from "@projectplaner/core";
import generator from "@projectplaner/core/generator";
import type { DatabaseController } from "@projectplaner/db";

import { drainPendingLlm } from "./drain-pending-llm";
import { createAgentRuntime } from "./create-agent-runtime";

const { readLlmChatConfigFromEnv } = generator.author;

export type AssistantTurnInput = {
  sessionId: string;
  message: string;
  patch?: unknown;
};

function readTurnOutputs(bag: WorkflowContextBag | undefined): { pack: unknown; reply: unknown; pendingDelegation: unknown } {
  const frame = bag?.frame;
  return {
    pack: frame?.outputs.contextPack ?? frame?.pins["llm_context::contextPack"],
    reply: frame?.outputs.reply ?? frame?.pins["llm_reply::reply"],
    pendingDelegation: frame?.outputs.pendingDelegationOut ?? frame?.pins["delegate::pendingDelegation"]
  };
}

function toAgentResult(run: { id: string; agentId: string; status: string; result?: unknown; error?: string }): WorkflowAgentResult {
  const result = run.result;
  return {
    runId: run.id,
    agentId: run.agentId,
    status: run.status,
    ...(run.status === "completed" && result !== undefined ? { result } : {}),
    ...(run.status === "waiting" && result && typeof result === "object" && typeof (result as { question?: unknown }).question === "string"
      ? { question: (result as { question: string }).question }
      : {}),
    ...(run.error ? { error: run.error } : {})
  };
}

async function createAssistantAgentAdapters(db: DatabaseController, projectKey: string) {
  const loadProfile = async (agentId: string) => {
    const entity = await db.entities.get(agentId);
    const project = await db.projects.findByKey(projectKey);
    if (!entity || entity.type !== "agent" || entity.status === "archived" || !project || entity.projectId !== project.id) {
      throw new Error(`Agent '${agentId}' is unavailable in project '${projectKey}'.`);
    }
    const profile = parseAgentProfile(entity.metadata);
    if (profile.kind === "assistant") {
      throw new Error("The Assistant cannot delegate to another Assistant profile.");
    }
    return { entity, profile };
  };
  const config = readLlmChatConfigFromEnv();
  if (!config) {
    return {
      runAgent: async (): Promise<WorkflowAgentResult> => ({ runId: "unavailable", agentId: "", status: "failed", error: "LLM is not configured." }),
      resumeAgent: async (): Promise<WorkflowAgentResult> => ({ runId: "unavailable", agentId: "", status: "failed", error: "LLM is not configured." })
    };
  }
  return {
    runAgent: async ({ agentId, task, projectKey: runProjectKey }: { agentId: string; task: string; projectKey: string }) => {
      const { profile } = await loadProfile(agentId);
      const history = agentConversation(await db.agentRuns.list(agentId, runProjectKey), agentId, runProjectKey);
      const runtime = createAgentRuntime(db, agentId, runProjectKey, profile, config, history);
      return toAgentResult(await runtime.start({ agentId, task, projectKey: runProjectKey }));
    },
    resumeAgent: async ({ runId, message, projectKey: runProjectKey }: { runId: string; message: string; projectKey: string }) => {
      const prior = await db.agentRuns.get(runId);
      if (!prior || prior.projectKey !== runProjectKey) {
        return { runId, agentId: prior?.agentId ?? "", status: "failed", error: "Pending agent run was not found in this project." } satisfies WorkflowAgentResult;
      }
      const { profile } = await loadProfile(prior.agentId);
      const history = agentConversation(await db.agentRuns.list(prior.agentId, runProjectKey), prior.agentId, runProjectKey);
      const runtime = createAgentRuntime(db, prior.agentId, runProjectKey, profile, config, history);
      return toAgentResult(await runtime.resume({ runId, result: { userMessage: message } }));
    }
  };
}

export async function runAssistantTurn(
  db: DatabaseController,
  input: AssistantTurnInput
): Promise<AssistantSessionRecord> {
  const existing = (await db.assistantSessions.get(input.sessionId));
  if (!existing) {
    throw new Error(`Unknown assistant session: ${input.sessionId}`);
  }

  const message = input.message.trim();
  const fixturePatch = input.patch !== undefined ? parsePatch(input.patch) : null;

  if (fixturePatch && Object.keys(fixturePatch).length > 0) {
    let session = appendMessage(existing.session, "user", message);
    session = mergeSession(session, fixturePatch);
    session = appendMessage(session, "assistant", "Updated session from fixture patch.");
    return (await db.assistantSessions.save(existing.id, session));
  }

  const config = readLlmChatConfigFromEnv();
  if (!config) {
    let session = appendMessage(existing.session, "user", message);
    session = appendMessage(
      session,
      "assistant",
      "LLM is not configured. Set PROJECTPLANER_LLM_BASE_URL and PROJECTPLANER_LLM_MODEL, or POST a fixture patch."
    );
    return (await db.assistantSessions.save(existing.id, session));
  }

  const projectKey = existing.session.context.projectKey || "PLAN";
  const agentAdapters = await createAssistantAgentAdapters(db, projectKey);
  const started = await db.workflows.run({
    key: "assistant_turn",
    projectKey,
    actor: "assistant",
    goal: "Assistant turn",
    bag: {
      session: existing.session,
      message,
      assistantSessionId: existing.id,
      windowSize: DEFAULT_ASSISTANT_WINDOW_SIZE,
      projectKey,
      knowledgeDataset: process.env.PROJECTPLANER_KNOWLEDGE_DATASET ?? `project-${projectKey.toLowerCase()}`,
      pendingDelegation: existing.session.pendingDelegation
    },
    adapters: agentAdapters
  });
  const drained = await drainPendingLlm(db, started, { adapters: agentAdapters });

  if (drained.step.kind === "failed") {
    throw new Error(drained.step.message ?? "Assistant turn failed.");
  }
  if (drained.step.kind !== "completed") {
    throw new Error(
      drained.note ?? "Assistant turn did not finish. Check PROJECTPLANER_LLM_* and drain the run."
    );
  }

  const { pack: rawPack, reply: rawReply, pendingDelegation: rawPendingDelegation } = readTurnOutputs(drained.step.bag);
  const pack = parseContextPack(rawPack, existing.session.context.projectKey);
  if (!pack) {
    throw new Error("Assistant turn completed without a valid contextPack.");
  }
  if (typeof rawReply !== "string" || !rawReply.trim()) {
    throw new Error("Assistant turn completed without a reply.");
  }

  let session = commitAssistantTurn(existing.session, message, pack, rawReply, drained.run.id);
  if (rawPendingDelegation && typeof rawPendingDelegation === "object" && !Array.isArray(rawPendingDelegation)) {
    const pending = rawPendingDelegation as Record<string, unknown>;
    if (typeof pending.runId === "string" && typeof pending.agentId === "string" && typeof pending.task === "string") {
      session.pendingDelegation = {
        runId: pending.runId,
        agentId: pending.agentId,
        task: pending.task,
        ...(typeof pending.question === "string" ? { question: pending.question } : {})
      };
    }
  } else {
    delete session.pendingDelegation;
  }
  return (await db.assistantSessions.save(existing.id, session));
}

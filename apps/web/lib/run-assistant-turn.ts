import {
  appendMessage,
  commitAssistantTurn,
  DEFAULT_ASSISTANT_WINDOW_SIZE,
  mergeSession,
  parseContextPack,
  parsePatch
} from "@projectplaner/core/assistant";
import type { AssistantSessionRecord } from "@projectplaner/core/assistant";
import type { WorkflowContextBag } from "@projectplaner/core";
import generator from "@projectplaner/core/generator";
import type { DatabaseSync } from "node:sqlite";
import assistantSessions from "@projectplaner/db/assistant-sessions";
import { runWorkflow } from "@projectplaner/db/workflows";
import { drainPendingLlm } from "./drain-pending-llm";

const { readLlmChatConfigFromEnv } = generator.author;

export type AssistantTurnInput = {
  sessionId: string;
  message: string;
  patch?: unknown;
};

function readTurnOutputs(bag: WorkflowContextBag | undefined): { pack: unknown; reply: unknown } {
  const frame = bag?.frame;
  return {
    pack: frame?.outputs.contextPack ?? frame?.pins["llm_context::contextPack"],
    reply: frame?.outputs.reply ?? frame?.pins["llm_reply::reply"]
  };
}

export async function runAssistantTurn(
  db: DatabaseSync,
  input: AssistantTurnInput
): Promise<AssistantSessionRecord> {
  const existing = assistantSessions.get(db, input.sessionId);
  if (!existing) {
    throw new Error(`Unknown assistant session: ${input.sessionId}`);
  }

  const message = input.message.trim();
  const fixturePatch = input.patch !== undefined ? parsePatch(input.patch) : null;

  if (fixturePatch && Object.keys(fixturePatch).length > 0) {
    let session = appendMessage(existing.session, "user", message);
    session = mergeSession(session, fixturePatch);
    session = appendMessage(session, "assistant", "Updated session from fixture patch.");
    return assistantSessions.save(db, existing.id, session);
  }

  const config = readLlmChatConfigFromEnv();
  if (!config) {
    let session = appendMessage(existing.session, "user", message);
    session = appendMessage(
      session,
      "assistant",
      "LLM is not configured. Set PROJECTPLANER_LLM_BASE_URL and PROJECTPLANER_LLM_MODEL, or POST a fixture patch."
    );
    return assistantSessions.save(db, existing.id, session);
  }

  const started = await runWorkflow(db, {
    key: "assistant_turn",
    projectKey: existing.session.context.projectKey || "PLAN",
    goal: "Assistant turn",
    bag: {
      session: existing.session,
      message,
      windowSize: DEFAULT_ASSISTANT_WINDOW_SIZE
    }
  });
  const drained = await drainPendingLlm(db, started);

  if (drained.step.kind === "failed") {
    throw new Error(drained.step.message ?? "Assistant turn failed.");
  }
  if (drained.step.kind !== "completed") {
    throw new Error(
      drained.note ?? "Assistant turn did not finish. Check PROJECTPLANER_LLM_* and drain the run."
    );
  }

  const { pack: rawPack, reply: rawReply } = readTurnOutputs(drained.step.bag);
  const pack = parseContextPack(rawPack, existing.session.context.projectKey);
  if (!pack) {
    throw new Error("Assistant turn completed without a valid contextPack.");
  }
  if (typeof rawReply !== "string" || !rawReply.trim()) {
    throw new Error("Assistant turn completed without a reply.");
  }

  return assistantSessions.save(
    db,
    existing.id,
    commitAssistantTurn(existing.session, message, pack, rawReply)
  );
}

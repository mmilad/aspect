import assistant from "@projectplaner/core/assistant";
import generator from "@projectplaner/core/generator";
import type { AssistantSessionRecord } from "@projectplaner/core/assistant";
import type { DatabaseSync } from "node:sqlite";
import assistantSessions from "@projectplaner/db/assistant-sessions";

const { appendMessage, merge, parsePatch, parseTurnOutput, schema, schemaName } = assistant;
const { chatCompletions, extractJsonObject, readLlmChatConfigFromEnv } = generator.author;

export type AssistantTurnInput = {
  sessionId: string;
  message: string;
  patch?: unknown;
};

function systemPrompt(): string {
  return [
    "You are the Projectplaner Assistant pane.",
    "Chat is a conversation document, not a graph entity. Do not invent Aspect/Feature/Task ids.",
    "Reply with a JSON object: { text, patch? }.",
    "text is the user-facing reply.",
    "patch may include summary (rewrite standing picture), currentTopic { id, title, why }, topics[], and must not invent graph entityId values unless the user named a real id.",
    "Rewrite summary; do not append forever. On topic change, set currentTopic and add it to topics."
  ].join(" ");
}

export async function runAssistantTurn(
  db: DatabaseSync,
  input: AssistantTurnInput
): Promise<AssistantSessionRecord> {
  const existing = assistantSessions.get(db, input.sessionId);
  if (!existing) {
    throw new Error(`Unknown assistant session: ${input.sessionId}`);
  }

  let session = appendMessage(existing.session, "user", input.message);
  const config = readLlmChatConfigFromEnv();
  const fixturePatch = input.patch !== undefined ? parsePatch(input.patch) : null;

  if (fixturePatch && Object.keys(fixturePatch).length > 0) {
    session = merge(session, fixturePatch);
    session = appendMessage(session, "assistant", "Updated session from fixture patch.");
    return assistantSessions.save(db, existing.id, session);
  }

  if (!config) {
    session = appendMessage(
      session,
      "assistant",
      "LLM is not configured. Set PROJECTPLANER_LLM_BASE_URL and PROJECTPLANER_LLM_MODEL, or POST a fixture patch."
    );
    return assistantSessions.save(db, existing.id, session);
  }

  const history = session.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content
  }));
  const raw = await chatCompletions(
    config,
    [{ role: "system", content: systemPrompt() }, ...history],
    { format: schema, jsonSchemaName: schemaName, temperature: 0.3 }
  );
  let output;
  try {
    output = parseTurnOutput(extractJsonObject(raw));
  } catch {
    output = parseTurnOutput({ text: raw });
  }
  if (!output) {
    throw new Error("Assistant turn returned an unreadable payload.");
  }
  session = appendMessage(session, "assistant", output.text);
  if (output.patch) {
    session = merge(session, output.patch);
  }
  return assistantSessions.save(db, existing.id, session);
}

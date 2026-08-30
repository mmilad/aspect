import type { AssistantMessage, AssistantMessageRole, AssistantSession } from "./types";

function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${uuid}`;
}

export function newMessage(role: AssistantMessageRole, content: string): AssistantMessage {
  return {
    id: newId("msg"),
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

export function appendMessage(
  session: AssistantSession,
  role: AssistantMessageRole,
  content: string
): AssistantSession {
  return {
    ...session,
    messages: [...session.messages, newMessage(role, content)]
  };
}

import type { AssistantMessage, AssistantSession, AssistantSessionPrior } from "./types";
import { parseSession } from "./parse";

export const DEFAULT_ASSISTANT_WINDOW_SIZE = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject non-objects; empty standing fields are still a valid session. */
export function requireAssistantSession(value: unknown): AssistantSession | null {
  if (!isRecord(value)) {
    return null;
  }
  return parseSession(value, "");
}

export function priorFromSession(session: AssistantSession): AssistantSessionPrior {
  const prior: AssistantSessionPrior = {
    priorTopics: session.topics,
    priorContext: session.context
  };
  if (session.summary) {
    prior.priorSummary = session.summary;
  }
  if (session.currentTopic) {
    prior.priorCurrentTopic = session.currentTopic;
  }
  return prior;
}

export function resolveWindowSize(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  return DEFAULT_ASSISTANT_WINDOW_SIZE;
}

export function sliceRecentTurns(
  messages: AssistantMessage[],
  windowSize?: unknown
): AssistantMessage[] {
  return messages.slice(-resolveWindowSize(windowSize));
}

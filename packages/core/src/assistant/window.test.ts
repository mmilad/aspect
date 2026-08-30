import { describe, expect, it } from "vitest";
import type { AssistantMessage, AssistantSession } from "./types";
import {
  DEFAULT_ASSISTANT_WINDOW_SIZE,
  priorFromSession,
  requireAssistantSession,
  resolveWindowSize,
  sliceRecentTurns
} from "./window";
import { emptySession } from "./parse";

function msg(index: number): AssistantMessage {
  return {
    id: `msg_${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `turn-${index}`,
    createdAt: "2026-08-30T00:00:00.000Z"
  };
}

describe("assistant session prior + window", () => {
  it("round-trips standing fields and allows a missing summary", () => {
    const withStanding: AssistantSession = {
      messages: [],
      summary: { text: "Working on auth" },
      topics: [{ id: "t_auth", title: "Auth", status: "active", weight: 1 }],
      questions: [{ id: "q1", text: "scope?", status: "open" }],
      context: { projectKey: "PLAN", entityId: "feature_abc" }
    };
    expect(priorFromSession(withStanding)).toEqual({
      priorSummary: { text: "Working on auth" },
      priorTopics: [{ id: "t_auth", title: "Auth", status: "active", weight: 1 }],
      priorQuestions: [{ id: "q1", text: "scope?", status: "open" }],
      priorContext: { projectKey: "PLAN", entityId: "feature_abc" }
    });

    const empty = emptySession("PLAN");
    expect(priorFromSession(empty)).toEqual({
      priorTopics: [],
      priorQuestions: [],
      priorContext: { projectKey: "PLAN" }
    });
    expect(priorFromSession(empty).priorSummary).toBeUndefined();
  });

  it("rejects a non-object session and parses a record", () => {
    expect(requireAssistantSession(null)).toBeNull();
    expect(requireAssistantSession("nope")).toBeNull();
    expect(requireAssistantSession({ context: { projectKey: "PLAN" } })).toEqual({
      messages: [],
      topics: [],
      questions: [],
      context: { projectKey: "PLAN" }
    });
  });

  it("slices last N turns and defaults size to 5", () => {
    const messages = Array.from({ length: 8 }, (_, index) => msg(index));
    expect(DEFAULT_ASSISTANT_WINDOW_SIZE).toBe(5);
    expect(resolveWindowSize(undefined)).toBe(5);
    expect(resolveWindowSize(0)).toBe(5);
    expect(resolveWindowSize(5)).toBe(5);
    expect(sliceRecentTurns(messages, 5).map((item) => item.content)).toEqual([
      "turn-3",
      "turn-4",
      "turn-5",
      "turn-6",
      "turn-7"
    ]);
    expect(sliceRecentTurns(messages).map((item) => item.content)).toEqual([
      "turn-3",
      "turn-4",
      "turn-5",
      "turn-6",
      "turn-7"
    ]);
  });
});

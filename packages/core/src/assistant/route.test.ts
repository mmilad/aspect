import { describe, expect, it } from "vitest";
import { parseAssistantRoute } from "./parse";

const base = { reason: "grounded reason" };

describe("assistant route parser", () => {
  it.each([
    { route: "reply" },
    { route: "clarify", question: "Which project?" },
    { route: "retrieve", lookupKind: "agents" },
    { route: "delegate", agentId: "agent_coding", task: "Inspect the build" },
    { route: "resume", runId: "run_123", message: "Here is the answer" }
  ])("accepts $route", value => {
    expect(parseAssistantRoute({ ...base, ...value })).toMatchObject(value);
  });

  it("rejects unknown routes and incomplete route payloads", () => {
    expect(parseAssistantRoute({ ...base, route: "invent" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "clarify" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "retrieve" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "retrieve", lookupKind: "agent" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "retrieve", lookupKind: "entities" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "delegate", agentId: "agent_coding" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "resume", runId: "run_123" })).toBeNull();
  });
});

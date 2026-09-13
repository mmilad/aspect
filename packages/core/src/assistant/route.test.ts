import { describe, expect, it } from "vitest";
import { parseAssistantRoute } from "./parse";

const base = { reason: "grounded reason" };

describe("assistant route parser", () => {
  it.each([
    { route: "reply" },
    { route: "clarify", question: "Which project?" },
    { route: "retrieve", lookupKind: "agents" },
    { route: "retrieve", lookupKind: "knowledge", lookupQuery: "release target", lookupDatasetKey: "project-plan" },
    { route: "retrieve", lookupKind: "files", lookupQuery: "src" },
    { route: "retrieve", lookupKind: "file", lookupId: "README.md" },
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
    expect(parseAssistantRoute({ ...base, route: "retrieve", lookupKind: "knowledge", lookupQuery: "release target" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "delegate", agentId: "agent_coding" })).toBeNull();
    expect(parseAssistantRoute({ ...base, route: "resume", runId: "run_123" })).toBeNull();
  });

  it("normalizes a dataset key supplied in the nested lookup object", () => {
    expect(parseAssistantRoute({
      ...base,
      route: "retrieve",
      lookupKind: "knowledge",
      lookupQuery: "release target",
      lookup: { kind: "knowledge", query: "release target", id: null, datasetKey: "project-plan" }
    })).toMatchObject({
      route: "retrieve",
      lookupDatasetKey: "project-plan",
      lookup: { kind: "knowledge", query: "release target", datasetKey: "project-plan" }
    });
  });

  it("uses the configured dataset only as a trusted knowledge-route fallback", () => {
    expect(parseAssistantRoute({
      ...base,
      route: "retrieve",
      lookupKind: "knowledge",
      lookupQuery: "my cat"
    }, "session_memory")).toMatchObject({
      route: "retrieve",
      lookupDatasetKey: "session_memory",
      lookup: { kind: "knowledge", query: "my cat", datasetKey: "session_memory" }
    });
    expect(parseAssistantRoute({
      ...base,
      route: "retrieve",
      lookupKind: "knowledge",
      lookupQuery: "my cat"
    })).toBeNull();
  });
});

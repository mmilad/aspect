import { describe, expect, it } from "vitest";
import { bindAgentKnowledgeWorkflowBag, buildAgentMemoryScope } from "./memory";

describe("agent memory scopes", () => {
  const base = { projectKey: "PLAN", agentId: "agent-1" };

  it("binds owned scopes to runtime identities", () => {
    expect(buildAgentMemoryScope({ ...base, scope: "personal", principalId: "user-1" }))
      .toEqual({ kind: "personal", ownerId: "user-1" });
    expect(buildAgentMemoryScope({ ...base, scope: "project" }))
      .toEqual({ kind: "project", projectKey: "PLAN" });
    expect(buildAgentMemoryScope({ ...base, scope: "agent" }))
      .toEqual({ kind: "agent", agentId: "agent-1" });
    expect(buildAgentMemoryScope({ ...base, scope: "global" }))
      .toEqual({ kind: "global" });
  });

  it("fails closed when the runtime identity is unavailable", () => {
    expect(buildAgentMemoryScope({ ...base, scope: "personal" })).toBeUndefined();
    expect(buildAgentMemoryScope({ ...base, scope: "session" })).toBeUndefined();
  });

  it("binds knowledge workflow inputs to the profile policy", () => {
    const bag = {
      datasetKey: "",
      scope: { kind: "personal", ownerId: "untrusted-owner", sourceId: "file-1" },
      query: "cat"
    };
    expect(bindAgentKnowledgeWorkflowBag({
      workflowId: "knowledge_retrieve",
      bag,
      datasetKey: "session_memory",
      ...base,
      scope: "personal",
      principalId: "user-1"
    })).toEqual({
      datasetKey: "session_memory",
      access: { projectKey: "PLAN", includeGlobal: true, principalId: "user-1" },
      scope: { kind: "personal", ownerId: "untrusted-owner", sourceId: "file-1" },
      query: "cat"
    });

    expect(bindAgentKnowledgeWorkflowBag({
      workflowId: "knowledge_remember",
      bag,
      datasetKey: "session_memory",
      ...base,
      scope: "personal",
      principalId: "user-1"
    })).toMatchObject({
      datasetKey: "session_memory",
      scope: { kind: "personal", ownerId: "user-1", sourceId: "file-1" }
    });
  });
});

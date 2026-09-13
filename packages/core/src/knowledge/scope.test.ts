import { describe, expect, it } from "vitest";
import { knowledgeScopeError, parseKnowledgeScope } from "./scope";

describe("knowledge ownership scopes", () => {
  it("requires the owner key for non-global scopes", () => {
    expect(knowledgeScopeError({ kind: "personal" })).toBe("scope.ownerId is required for a personal scope.");
    expect(knowledgeScopeError({ kind: "project" })).toBe("scope.projectKey is required for a project scope.");
    expect(knowledgeScopeError({ kind: "agent" })).toBe("scope.agentId is required for an agent scope.");
    expect(knowledgeScopeError({ kind: "session" })).toBe("scope.sessionId is required for a session scope.");
  });

  it("accepts explicit global and owned scopes without changing them", () => {
    const scope = { kind: "project" as const, projectKey: "PLAN", sourceId: "entity-1" };
    expect(knowledgeScopeError({ kind: "global" })).toBeUndefined();
    expect(parseKnowledgeScope(scope)).toEqual(scope);
    expect(parseKnowledgeScope({ kind: "project" })).toBeUndefined();
  });

  it("rejects malformed scope values", () => {
    expect(knowledgeScopeError(undefined)).toBe("scope must be an object.");
    expect(knowledgeScopeError({ kind: "unknown" })).toBe("scope.kind must be global, personal, project, agent, or session.");
  });
});

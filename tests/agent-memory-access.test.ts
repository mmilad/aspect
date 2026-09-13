import { describe, expect, it } from "vitest";
import { buildAgentMemoryAccess } from "@projectplaner/core";

describe("agent memory access", () => {
  it("keeps project-scoped agents away from personal records", () => {
    expect(buildAgentMemoryAccess({ projectKey: "PLAN", agentId: "agent-1", scope: "project", principalId: "alice" }))
      .toEqual({ projectKey: "PLAN", includeGlobal: true });
  });

  it("uses the principal only for personal memory", () => {
    expect(buildAgentMemoryAccess({ projectKey: "PLAN", agentId: "agent-1", scope: "personal", principalId: "alice" }))
      .toEqual({ projectKey: "PLAN", includeGlobal: true, principalId: "alice" });
  });

  it("uses the agent owner for agent-scoped memory", () => {
    expect(buildAgentMemoryAccess({ projectKey: "PLAN", agentId: "agent-1", scope: "agent", principalId: "alice" }))
      .toEqual({ projectKey: "PLAN", includeGlobal: true, agentId: "agent-1" });
  });
});

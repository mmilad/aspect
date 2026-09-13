import { expect, it } from "vitest";
import { parseAgentProfile } from "./profile";

it("normalizes policies while preserving explicit memory opt-in", () => {
  const profile = parseAgentProfile({ document: {
    contextPolicy: { graphEnabled: "yes", maxResults: -1, memoryEnabled: true },
    runtimePolicy: { maxSteps: "20", maxWorkflowCalls: -5, canAskClarification: 1 }
  } });
  expect(profile.contextPolicy).toEqual({ graphEnabled: true, maxResults: 12, memoryEnabled: true });
  expect(profile.runtimePolicy.maxSteps).toBe(20);
  expect(profile.runtimePolicy.maxWorkflowCalls).toBe(5);
  expect(profile.memoryPolicy.enabled).toBe(false);
});

it("parses a valid scoped memory policy", () => {
  const profile = parseAgentProfile({
    contextPolicy: { memoryEnabled: true },
    memoryPolicy: { enabled: true, scope: "agent" }
  });
  expect(profile.contextPolicy.memoryEnabled).toBe(true);
  expect(profile.memoryPolicy).toEqual({ enabled: true, scope: "agent" });
});

it("retains valid profiles and defaults identically for recruitment and runtime", () => {
  const raw = { name: "Coder", role: "Developer", capabilities: ["Coding"],
    contextPolicy: { graphEnabled: false, maxResults: 30, maxContextTokens: 8000 },
    runtimePolicy: { maxSteps: 4, maxWorkflowCalls: 0 }, projectScope: { workspaceId: "w" } };
  const profile = parseAgentProfile(raw);
  expect(parseAgentProfile({ document: profile })).toEqual(profile);
  expect(profile.runtimePolicy.maxWorkflowCalls).toBe(0);
  expect(profile.projectScope?.workspaceId).toBe("w");
});

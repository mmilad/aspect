import { expect, it } from "vitest";
import { parseAgentProfile } from "./profile";

it("normalizes invalid policies and keeps memory disabled", () => {
  const profile = parseAgentProfile({ document: {
    contextPolicy: { graphEnabled: "yes", maxResults: -1, memoryEnabled: true },
    runtimePolicy: { maxSteps: "20", maxWorkflowCalls: -5, canAskClarification: 1 }
  } });
  expect(profile.contextPolicy).toEqual({ graphEnabled: true, maxResults: 12, memoryEnabled: false });
  expect(profile.runtimePolicy.maxSteps).toBe(20);
  expect(profile.runtimePolicy.maxWorkflowCalls).toBe(5);
  expect(profile.memoryPolicy.enabled).toBe(false);
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

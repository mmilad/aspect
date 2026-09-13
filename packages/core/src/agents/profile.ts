import type { JsonRecord } from "../domain/types";
import type { AgentMemoryScope, AgentProfile } from "./types";

const object = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const list = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string" && !!item.trim()) : [];
const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const integer = (value: unknown, fallback: number, minimum = 1) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : fallback;
const memoryScopes = new Set<AgentMemoryScope>(["global", "personal", "project", "agent", "session"]);

export function parseAgentProfile(metadata: JsonRecord): AgentProfile {
  const raw = metadata.document === undefined ? metadata : object(metadata.document);
  const context = object(raw.contextPolicy);
  const runtime = object(raw.runtimePolicy);
  const scope = object(raw.projectScope);
  return {
    profileVersion: 1,
    kind: raw.kind === "assistant" ? "assistant" : "specialist",
    name: text(raw.name), role: text(raw.role), instructions: text(raw.instructions),
    responsibilities: list(raw.responsibilities), recurringActivities: list(raw.recurringActivities),
    capabilities: list(raw.capabilities), decisionAreas: list(raw.decisionAreas),
    candidateWorkflows: list(raw.candidateWorkflows), assignedWorkflowIds: list(raw.assignedWorkflowIds),
    registeredCapabilities: list(raw.registeredCapabilities),
    projectScope: {
      projectKey: typeof scope.projectKey === "string" ? scope.projectKey : undefined,
      workspaceId: typeof scope.workspaceId === "string" ? scope.workspaceId : undefined
    },
    contextPolicy: {
      graphEnabled: bool(context.graphEnabled, true), memoryEnabled: bool(context.memoryEnabled, false),
      maxResults: integer(context.maxResults, 12),
      ...(context.maxContextTokens === undefined ? {} : { maxContextTokens: integer(context.maxContextTokens, 4096) })
    },
    runtimePolicy: {
      maxSteps: integer(runtime.maxSteps, 20), maxWorkflowCalls: integer(runtime.maxWorkflowCalls, 5, 0),
      canAskClarification: bool(runtime.canAskClarification, true),
      humanConfirmationDefault: bool(runtime.humanConfirmationDefault, false)
    },
    memoryPolicy: {
      enabled: bool(object(raw.memoryPolicy).enabled, false),
      scope: memoryScopes.has(object(raw.memoryPolicy).scope as AgentMemoryScope)
        ? object(raw.memoryPolicy).scope as AgentMemoryScope
        : "project"
    },
    history: Array.isArray(raw.history) ? raw.history as AgentProfile["history"] : []
  };
}

/** Reserved runtime profile for the read-only conversational Assistant. */
export function createAssistantAgentProfile(projectKey = "PLAN"): AgentProfile {
  return {
    profileVersion: 1,
    kind: "assistant",
    name: "Projectplaner Assistant",
    role: "Conversational project assistant",
    instructions: "Answer from confirmed project context and registered specialist results.",
    responsibilities: [],
    recurringActivities: [],
    capabilities: [],
    decisionAreas: [],
    candidateWorkflows: ["assistant_turn"],
    assignedWorkflowIds: [],
    registeredCapabilities: [],
    projectScope: { projectKey },
    permissions: { readProject: true, inspectAgents: true, delegate: true, writeProject: false },
    contextPolicy: { graphEnabled: true, memoryEnabled: false, maxResults: 20 },
    runtimePolicy: { maxSteps: 20, maxWorkflowCalls: 0, canAskClarification: true, humanConfirmationDefault: false },
    memoryPolicy: { enabled: false, scope: "project" },
    history: []
  };
}

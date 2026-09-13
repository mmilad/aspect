import type { AgentMemoryScope } from "./types";
import type { KnowledgeScope } from "../knowledge";

/** Build the ownership filter used when a specialist reads CortexDB memory. */
export function buildAgentMemoryAccess(input: {
  projectKey: string;
  agentId: string;
  scope: AgentMemoryScope;
  principalId?: string;
}): {
  projectKey: string;
  includeGlobal: true;
  principalId?: string;
  agentId?: string;
} {
  return {
    projectKey: input.projectKey,
    includeGlobal: true,
    ...(input.scope === "personal" && input.principalId ? { principalId: input.principalId } : {}),
    ...(input.scope === "agent" ? { agentId: input.agentId } : {})
  };
}

/**
 * Build the ownership scope an agent may use when a memory workflow needs to
 * write knowledge. The profile policy is authoritative; the model may not
 * choose a different owner. Session-scoped memory needs a session id and is
 * therefore left for the caller to provide explicitly.
 */
export function buildAgentMemoryScope(input: {
  projectKey: string;
  agentId: string;
  scope: AgentMemoryScope;
  principalId?: string;
}): KnowledgeScope | undefined {
  switch (input.scope) {
    case "global":
      return { kind: "global" };
    case "personal":
      return input.principalId ? { kind: "personal", ownerId: input.principalId } : undefined;
    case "project":
      return { kind: "project", projectKey: input.projectKey };
    case "agent":
      return { kind: "agent", agentId: input.agentId };
    case "session":
      return undefined;
  }
}

const agentKnowledgeWorkflows = new Set(["knowledge_retrieve", "knowledge_remember", "knowledge_capture_file"]);

/** Bind specialist knowledge workflow inputs to the agent's runtime identity. */
export function bindAgentKnowledgeWorkflowBag(input: {
  workflowId: string;
  bag: Record<string, unknown>;
  datasetKey: string;
  projectKey: string;
  agentId: string;
  scope: AgentMemoryScope;
  principalId?: string;
}): Record<string, unknown> {
  if (!agentKnowledgeWorkflows.has(input.workflowId)) return input.bag;

  const next = { ...input.bag };
  if (typeof next.datasetKey !== "string" || !next.datasetKey.trim()) next.datasetKey = input.datasetKey;

  if (input.workflowId === "knowledge_retrieve") {
    next.access = buildAgentMemoryAccess(input);
    return next;
  }

  const scope = buildAgentMemoryScope(input);
  if (scope) {
    const sourceId = next.scope && typeof next.scope === "object" && !Array.isArray(next.scope)
      && typeof (next.scope as { sourceId?: unknown }).sourceId === "string"
      ? (next.scope as { sourceId: string }).sourceId
      : undefined;
    next.scope = sourceId ? { ...scope, sourceId } : scope;
  }
  return next;
}

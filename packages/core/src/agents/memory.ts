import type { AgentMemoryScope } from "./types";

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

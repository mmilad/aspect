import type { AgentRun, AgentRunEvent } from "@projectplaner/core";

export interface Operations {
  create(run: AgentRun): Promise<AgentRun>;
  get(id: string): Promise<AgentRun | null>;
  update(run: AgentRun): Promise<AgentRun>;
  finish(run: AgentRun): Promise<AgentRun>;
  list(agentId: string, projectKey?: string): Promise<AgentRun[]>;
  createEvent(event: AgentRunEvent): Promise<AgentRunEvent>;
  listEvents(runId: string, afterId?: string): Promise<AgentRunEvent[]>;
}

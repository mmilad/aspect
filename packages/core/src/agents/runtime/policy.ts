import type { AgentProfile } from "../types";

export function canRunWorkflow(agent: AgentProfile, workflowId: string): boolean {
  return agent.assignedWorkflowIds.includes(workflowId);
}

export function canRunCapability(agent: AgentProfile, name: string): boolean {
  return agent.capabilities.includes(name);
}

export function defaultRuntimePolicy(agent?: Partial<AgentProfile["runtimePolicy"]>): AgentProfile["runtimePolicy"] {
  return { maxSteps: 20, maxWorkflowCalls: 5, canAskClarification: true, humanConfirmationDefault: false, ...agent };
}

import type { WorkflowPreset } from "../types";
import { recruitAgentGraph } from "./graph";
export const recruitAgentPreset: WorkflowPreset = {
    presetKey: "recruit_agent",
    presetVersion: 3,
    title: "Recruit agent",
    summary: "Research a role, build an agent profile, and persist it for later workflow assignment.",
    body: "Inputs: query, optional instructions, and maxResults. Outputs: sources, structured responsibilities, and agentId.",
    status: "accepted",
    kind: "builder",
    graph: recruitAgentGraph,
    drainLlm: true
};

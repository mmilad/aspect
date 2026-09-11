import type { AgentHistoryEntry, AgentHistoryType } from "./types";
const MAX_HISTORY = 100;
export function createHistoryEntry(input: {
    runId: string;
    type: AgentHistoryType;
    summary: string;
    sourceIds?: string[];
    workflowId?: string;
}): AgentHistoryEntry {
    return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...input,
        summary: input.summary.slice(0, 1000)
    };
}
export function limitHistory(entries: AgentHistoryEntry[], max = MAX_HISTORY): AgentHistoryEntry[] {
    return entries.slice(-max);
}

import type { AgentContextSource } from "../types";
export type AgentRunEventType = "run_started" | "context_loading" | "context_loaded" | "llm_started" | "llm_completed" | "run_completed" | "run_failed" | "run_canceled";
export interface AgentRunEvent {
    id: string;
    runId: string;
    type: AgentRunEventType;
    message: string;
    createdAt: string;
    data?: Record<string, unknown>;
}
export interface AgentRunEventSink {
    emit(event: Omit<AgentRunEvent, "id" | "createdAt">): Promise<void>;
}
export type AgentContextEventData = {
    sources: AgentContextSource[];
};

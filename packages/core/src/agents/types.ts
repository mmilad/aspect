export type AgentRunStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "canceled";
export type AgentHistoryType = "observation" | "decision" | "result" | "error" | "workflow";
export type AgentKind = "assistant" | "specialist";
export interface AgentHistoryEntry {
    id: string;
    runId: string;
    type: AgentHistoryType;
    summary: string;
    sourceIds?: string[];
    workflowId?: string;
    createdAt: string;
}
export interface AgentWorkspaceContext {
    workspaceId?: string;
    repositoryPath?: string;
    branch?: string;
    allowedPaths?: string[];
}
export interface AgentProfile {
    profileVersion: 1;
    kind: AgentKind;
    permissions?: {
        readProject: boolean;
        inspectAgents: boolean;
        delegate: boolean;
        writeProject: boolean;
    };
    name: string;
    role: string;
    instructions: string;
    responsibilities: string[];
    recurringActivities: string[];
    capabilities: string[];
    decisionAreas: string[];
    candidateWorkflows: string[];
    assignedWorkflowIds: string[];
    projectScope?: {
        projectKey?: string;
        workspaceId?: string;
    };
    contextPolicy: {
        graphEnabled: boolean;
        memoryEnabled: false;
        maxResults: number;
        maxContextTokens?: number;
    };
    runtimePolicy: {
        maxSteps: number;
        maxWorkflowCalls: number;
        canAskClarification: boolean;
        humanConfirmationDefault: boolean;
    };
    memoryPolicy: {
        enabled: false;
        scope: "project";
    };
    history: AgentHistoryEntry[];
}
export interface AgentContextSource {
    id: string;
    type: string;
    title: string;
    summary?: string;
    relevance?: number;
}
export interface AgentContextPacket {
    sources: AgentContextSource[];
    text: string;
    truncated: boolean;
}
export interface AgentRun {
    id: string;
    agentId: string;
    projectKey: string;
    task: string;
    status: AgentRunStatus;
    workspace?: AgentWorkspaceContext;
    context?: AgentContextPacket;
    stepCount: number;
    workflowCallCount: number;
    result?: unknown;
    error?: string;
    startedAt: string;
    finishedAt?: string;
}
export interface ContextProvider {
    getContext(input: {
        task: string;
        agent: AgentProfile;
        projectKey: string;
        limit: number;
    }): Promise<AgentContextPacket>;
}
export interface MemorySearchInput {
    task: string;
    projectKey: string;
    limit: number;
}
export interface MemoryWriteInput {
    runId: string;
    projectKey: string;
    summary: string;
}
export interface MemoryItem {
    id: string;
    content: string;
    scope: string;
    source?: string;
    confidence?: number;
}
export interface MemoryProvider {
    search(input: MemorySearchInput): Promise<MemoryItem[]>;
    remember(input: MemoryWriteInput): Promise<MemoryItem>;
}
export type AgentDecision = {
    type: "complete";
    result: unknown;
    summary?: string;
} | {
    type: "clarification";
    question: string;
} | {
    type: "workflow";
    workflowId: string;
    bag?: Record<string, unknown>;
} | {
    type: "capability";
    name: string;
    args?: Record<string, unknown>;
};
export interface AgentExecutionAdapters {
    runWorkflow(input: {
        workflowId: string;
        projectKey: string;
        bag: Record<string, unknown>;
        workspace?: AgentWorkspaceContext;
    }): Promise<{
        runId: string;
        status: string;
        bag: Record<string, unknown>;
    }>;
    runCapability(input: {
        name: string;
        args: Record<string, unknown>;
    }): Promise<Record<string, unknown>>;
    runLlm?(input: {
        task: string;
        agent: AgentProfile;
        context: AgentContextPacket;
        previousResult?: unknown;
    }): Promise<AgentDecision>;
}
export interface AgentRunStore {
    get(runId: string): Promise<AgentRun | null>;
    save(run: AgentRun): Promise<void>;
    finish?(run: AgentRun): Promise<AgentRun>;
}
export interface AgentRunEventStore {
    create(event: AgentRunEvent): Promise<AgentRunEvent>;
    list(runId: string, afterId?: string): Promise<AgentRunEvent[]>;
}
export interface AgentProfileStore {
    get(agentId: string): Promise<AgentProfile | null>;
    saveHistory(agentId: string, entry: AgentHistoryEntry): Promise<void>;
}
export interface AgentRuntime {
    start(input: {
        agentId: string;
        task: string;
        projectKey: string;
        workspace?: AgentWorkspaceContext;
    }): Promise<AgentRun>;
    resume(input: {
        runId: string;
        result?: unknown;
    }): Promise<AgentRun>;
    cancel(runId: string): Promise<AgentRun>;
}
import type { AgentRunEvent } from "./runtime/events";

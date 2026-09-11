import type { AgentContextPacket, ContextProvider } from "./types";
import type { WorkflowAdapters } from "../workflow/runtime/adapters";
export function createGraphContextProvider(adapters: Pick<WorkflowAdapters, "loadContext">): ContextProvider {
    return {
        async getContext(input) {
            if (!input.agent.contextPolicy.graphEnabled || !adapters.loadContext)
                return {
                    sources: [],
                    text: "",
                    truncated: false
                };
            const matches = await adapters.loadContext({
                query: input.task,
                limit: Math.min(input.limit, input.agent.contextPolicy.maxResults),
                mode: "query"
            });
            const sources = matches.map((m) => ({
                id: m.id,
                type: m.type,
                title: m.title,
                summary: m.summary,
                relevance: m.score
            }));
            const text = sources.map((s) => `[${s.type}] ${s.title}${s.summary ? `: ${s.summary}` : ""}`).join("\n");
            return {
                sources,
                text,
                truncated: matches.length >= input.limit
            };
        }
    };
}

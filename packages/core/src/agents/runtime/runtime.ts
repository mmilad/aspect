import { isTerminal, terminalEvent } from "./terminal";
import { createHistoryEntry } from "../history";
import { canRunCapability, canRunWorkflow } from "./policy";
import type { AgentExecutionAdapters, AgentHistoryEntry, AgentProfile, AgentProfileStore, AgentRun, AgentRunStore, AgentRuntime as AgentRuntimeContract, ContextProvider } from "../types";
import type { AgentRunEventSink } from "./events";
export class DefaultAgentRuntime implements AgentRuntimeContract {
    constructor(private readonly profiles: AgentProfileStore, private readonly runs: AgentRunStore, private readonly context: ContextProvider, private readonly adapters: AgentExecutionAdapters, private readonly events?: AgentRunEventSink) { }
    async start(input: {
        agentId: string;
        task: string;
        projectKey: string;
        workspace?: AgentRun["workspace"];
    }): Promise<AgentRun> {
        const agent = await this.profiles.get(input.agentId);
        if (!agent)
            throw new Error(`Agent '${input.agentId}' was not found.`);
        if (!input.task.trim() || !input.projectKey.trim())
            throw new Error("Agent task and projectKey are required.");
        const run: AgentRun = { id: crypto.randomUUID(), agentId: input.agentId, projectKey: input.projectKey, task: input.task, workspace: input.workspace, status: "running", stepCount: 0, workflowCallCount: 0, startedAt: new Date().toISOString() };
        await this.runs.save(run);
        await this.emit(run, "run_started", "Agent run started.");
        return this.advance(run, agent);
    }
    async resume(input: {
        runId: string;
        result?: unknown;
    }): Promise<AgentRun> {
        const run = await this.runs.get(input.runId);
        if (!run)
            throw new Error(`Agent run '${input.runId}' was not found.`);
        if (["completed", "failed", "canceled"].includes(run.status))
            return run;
        const agent = await this.profiles.get(run.agentId);
        if (!agent)
            throw new Error(`Agent '${run.agentId}' was not found.`);
        return this.advance(run, agent, input.result);
    }
    async cancel(runId: string): Promise<AgentRun> {
        const run = await this.runs.get(runId);
        if (!run)
            throw new Error(`Agent run '${runId}' was not found.`);
        if (["completed", "failed", "canceled"].includes(run.status))
            return run;
        run.status = "canceled";
        run.finishedAt = new Date().toISOString();
        return this.persistTerminal(run);
    }
    private async advance(run: AgentRun, agent: AgentProfile, previousResult?: unknown): Promise<AgentRun> {
        try {
            if (!this.adapters.runLlm)
                throw new Error("Agent LLM execution is not configured.");
            if (!run.context) {
                await this.emit(run, "context_loading", "Loading project context.");
                run.context = await this.context.getContext({ task: run.task, agent, projectKey: run.projectKey, limit: agent.contextPolicy.maxResults });
                await this.emit(run, "context_loaded", `${run.context.sources.length} project sources loaded.`, { sourceIds: run.context.sources.map((source) => source.id) });
            }
            if (run.stepCount >= agent.runtimePolicy.maxSteps)
                throw new Error("Agent step limit exceeded.");
            run.stepCount += 1;
            await this.emit(run, "llm_started", "Processing the task with the agent model.");
            const decision = await this.adapters.runLlm({ task: run.task, agent, context: run.context, previousResult });
            const persisted = await this.runs.get(run.id);
            if (persisted?.status === "canceled")
                return persisted;
            await this.emit(run, "llm_completed", "Agent model returned a response.");
            if (decision.type === "complete")
                return await this.finish(run, decision.result, "Agent completed the task.");
            if (decision.type === "clarification") {
                run.status = "waiting";
                run.result = { question: decision.question };
                await this.record(run, "decision", decision.question);
                await this.runs.save(run);
                return run;
            }
            if (decision.type === "workflow") {
                if (!canRunWorkflow(agent, decision.workflowId))
                    throw new Error(`Workflow '${decision.workflowId}' is not assigned to this agent.`);
                if (run.workflowCallCount >= agent.runtimePolicy.maxWorkflowCalls)
                    throw new Error("Agent workflow-call limit exceeded.");
                run.workflowCallCount += 1;
                const result = await this.adapters.runWorkflow({ workflowId: decision.workflowId, projectKey: run.projectKey, workspace: run.workspace, bag: decision.bag ?? {} });
                await this.record(run, "workflow", `Workflow ${decision.workflowId} completed.`, undefined, decision.workflowId);
                return this.advance(run, agent, result.bag);
            }
            if (!canRunCapability(agent, decision.name))
                throw new Error(`Capability '${decision.name}' is not allowed for this agent.`);
            const result = await this.adapters.runCapability({ name: decision.name, args: decision.args ?? {} });
            return this.advance(run, agent, result);
        }
        catch (error) {
            const persisted = await this.runs.get(run.id);
            if (persisted && isTerminal(persisted.status)) return persisted;
            run.status = "failed";
            run.error = "Agent execution failed. Check model configuration and final-answer format.";
            run.finishedAt = new Date().toISOString();
            await this.record(run, "error", run.error);
            return this.persistTerminal(run);
        }
    }
    private async finish(run: AgentRun, result: unknown, summary: string) {
        if (result == null || result === "")
            throw new Error("Agent completed without a result.");
        run.status = "completed";
        run.result = result;
        run.finishedAt = new Date().toISOString();
        await this.record(run, "result", summary);
        return this.persistTerminal(run);
    }
    private async persistTerminal(run: AgentRun): Promise<AgentRun> {
        if (this.runs.finish) return this.runs.finish(run);
        await this.runs.save(run);
        await this.events?.emit(terminalEvent(run));
        return run;
    }
    private async emit(run: AgentRun, type: import("./events").AgentRunEventType, message: string, data?: Record<string, unknown>) { await this.events?.emit({ runId: run.id, type, message, data }); }
    private async record(run: AgentRun, type: AgentHistoryEntry["type"], summary: string, sourceIds?: string[], workflowId?: string) { await this.profiles.saveHistory(run.agentId, createHistoryEntry({ runId: run.id, type, summary, sourceIds, workflowId })); }
}

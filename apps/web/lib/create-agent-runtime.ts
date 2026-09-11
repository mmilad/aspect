import { DIRECT_AGENT_CAPABILITIES, DefaultAgentRuntime, parseAgentCompletion, type AgentProfile } from "@projectplaner/core";
import type { DatabaseController } from "@projectplaner/db";
import generator from "@projectplaner/core/generator";

const { chatCompletions } = generator.author;
export function createAgentRuntime(
  db: DatabaseController, agentId: string, projectKey: string,
  profile: AgentProfile, config: Parameters<typeof chatCompletions>[0],
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  return new DefaultAgentRuntime(
    { get: async id => id === agentId ? profile : null, saveHistory: async () => undefined },
    {
      get: id => db.agentRuns.get(id),
      finish: run => db.agentRuns.finish(run),
      async save(run) {
        const existing = await db.agentRuns.get(run.id);
        if (existing?.status === "canceled") return;
        if (existing) await db.agentRuns.update(run);
        else await db.agentRuns.create(run);
      }
    },
    {
      async getContext() {
        const entities = profile.contextPolicy.graphEnabled
          ? await db.entities.list({ projectKey }) : [];
        const sources = entities.slice(0, profile.contextPolicy.maxResults).map(item => ({
          id: item.id, type: item.type, title: item.title, summary: item.summary
        }));
        return {
          sources,
          text: sources.map(source => source.type + ': ' + source.title + ' - ' + (source.summary ?? '')).join('\n'),
          truncated: entities.length > sources.length
        };
      }
    },
    {
      async runWorkflow() { throw new Error("Workflow execution is not enabled for agent V1."); },
      async runCapability() { throw new Error("Capability execution is not enabled for agent V1."); },
      async runLlm({ task, agent, context }) {
        const text = await chatCompletions(config, [
          { role: "system", content: [
            'You are ' + agent.name + ', a ' + agent.role + '.', agent.instructions,
            'Provide only the final answer, never private reasoning.',
            DIRECT_AGENT_CAPABILITIES,
            'Respond only as JSON: {"type":"complete","result":"..."}.'
          ].join('\n') },
          ...history,
          { role: "user", content: 'Task: ' + task + '\nProject context:\n' + context.text }
        ], { format: "json", jsonSchemaName: "agent_decision_v1" });
        return parseAgentCompletion(text);
      }
    },
    {
      async emit(event) {
        await db.agentRuns.createEvent({
          id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...event
        });
      }
    }
  );
}

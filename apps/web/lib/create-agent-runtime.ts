import { buildAgentMemoryAccess, DIRECT_AGENT_CAPABILITIES, DefaultAgentRuntime, parseAgentCompletion, type AgentProfile } from "@projectplaner/core";
import { AGENT_DECISION_V1_SCHEMA } from "@projectplaner/core/workflow";
import { createConfiguredKnowledgeSearchProvider, type DatabaseController } from "@projectplaner/db";
import generator from "@projectplaner/core/generator";
import { drainPendingLlm } from "./drain-pending-llm";

const { chatCompletions } = generator.author;

export function createAgentRuntime(
  db: DatabaseController, agentId: string, projectKey: string,
  profile: AgentProfile, config: Parameters<typeof chatCompletions>[0],
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const knowledgeSearch = createConfiguredKnowledgeSearchProvider(projectKey);
  const principalId = process.env.PROJECTPLANER_PRINCIPAL_ID?.trim();
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
      async getContext(input) {
        const memoryEnabled = profile.contextPolicy.memoryEnabled && profile.memoryPolicy.enabled && !!knowledgeSearch;
        const limit = Math.min(profile.contextPolicy.maxResults, 20);
        const graphLimit = memoryEnabled ? Math.ceil(limit / 2) : limit;
        const entities = profile.contextPolicy.graphEnabled
          ? await db.entities.list({ projectKey }) : [];
        const graphSources = entities.slice(0, graphLimit).map(item => ({
          id: item.id, type: item.type, title: item.title, summary: item.summary
        }));
        const memorySources = memoryEnabled && knowledgeSearch
          ? (await knowledgeSearch({
              datasetKey: process.env.PROJECTPLANER_KNOWLEDGE_DATASET ?? `project-${projectKey.toLowerCase()}`,
              query: input.task,
              topK: Math.max(1, limit - graphSources.length),
              access: buildAgentMemoryAccess({ projectKey, agentId, scope: profile.memoryPolicy.scope, principalId })
            })).hits.map(hit => ({
              id: `memory:${hit.id}`,
              type: `memory:${hit.scope.kind}`,
              title: hit.rawText.slice(0, 120),
              summary: hit.rawText,
              relevance: hit.score
            }))
          : [];
        const sources = [...graphSources, ...memorySources].slice(0, limit);
        return {
          sources,
          text: sources.map(source => source.type + ': ' + source.title + ' - ' + (source.summary ?? '')).join('\n'),
          truncated: entities.length > graphSources.length || memorySources.length >= Math.max(1, limit - graphSources.length)
        };
      }
    },
    {
      async runWorkflow({ workflowId, projectKey: runProjectKey, bag }) {
        const workflowEntity = await db.entities.get(workflowId);
        const started = await db.workflows.run({
          ...(workflowEntity?.type === "flow" ? { id: workflowId } : { key: workflowId }),
          projectKey: runProjectKey,
          goal: `Agent ${agentId}: assigned workflow ${workflowId}`,
          bag,
          actor: "agent"
        });
        const result = await drainPendingLlm(db, started);
        return { runId: result.run.id, status: result.run.status, bag: result.step.bag.keys };
      },
      async runCapability({ name, args }) {
        if (name === "project.list_agents") {
          return { agents: (await db.entities.list({ projectKey, type: "agent" })).filter(item => item.status !== "archived") };
        }
        if (name === "project.get_entity") {
          const id = typeof args.id === "string" ? args.id : "";
          if (!id) throw new Error("project.get_entity requires args.id.");
          const entity = await db.entities.get(id);
          if (!entity || entity.projectId !== (await db.projects.findByKey(projectKey))?.id || entity.status === "archived") {
            throw new Error(`Entity '${id}' was not found in project '${projectKey}'.`);
          }
          return { entity };
        }
        throw new Error(`Capability '${name}' is unavailable: no registered implementation.`);
      },
      async runLlm({ task, agent, context, previousResult }) {
        const text = await chatCompletions(config, [
          { role: "system", content: [
            'You are ' + agent.name + ', a ' + agent.role + '.', agent.instructions,
            'Provide only the final answer, never private reasoning.',
            DIRECT_AGENT_CAPABILITIES,
            'Choose exactly one decision: complete, clarification, workflow, or capability.',
            'Use only assigned workflows and registered capabilities. Unknown capabilities are unavailable.',
            'Assigned workflow IDs: ' + JSON.stringify(agent.assignedWorkflowIds),
            'Registered capability names: ' + JSON.stringify(agent.registeredCapabilities),
            'Respond only with the agent_decision_v1 JSON object.'
          ].join('\n') },
          ...history,
          { role: "user", content: 'Task: ' + task + '\nProject context:\n' + context.text + '\nPrevious confirmed result: ' + JSON.stringify(previousResult ?? null) }
        ], { format: AGENT_DECISION_V1_SCHEMA, jsonSchemaName: "agent_decision_v1" });
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

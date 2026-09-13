import { describe, expect, it, vi } from "vitest";
import type { AgentProfile } from "@projectplaner/core";

vi.mock("@projectplaner/db", () => ({
  createConfiguredKnowledgeSearchProvider: () => vi.fn()
}));

import { createAgentRuntime } from "../apps/web/lib/create-agent-runtime";

function profile(): AgentProfile {
  return {
    profileVersion: 1,
    kind: "specialist",
    name: "Memory specialist",
    role: "Knowledge researcher",
    instructions: "Use grounded project knowledge.",
    responsibilities: [],
    recurringActivities: [],
    capabilities: [],
    decisionAreas: [],
    candidateWorkflows: ["knowledge_retrieve"],
    assignedWorkflowIds: ["knowledge_retrieve"],
    registeredCapabilities: [],
    projectScope: { projectKey: "PLAN" },
    contextPolicy: { graphEnabled: false, memoryEnabled: true, maxResults: 4 },
    runtimePolicy: { maxSteps: 2, maxWorkflowCalls: 1, canAskClarification: true, humanConfirmationDefault: false },
    memoryPolicy: { enabled: true, scope: "personal" },
    history: []
  };
}

describe("createAgentRuntime knowledge context", () => {
  it("retrieves scoped memory through the knowledge workflow", async () => {
    const workflowCalls: Array<Record<string, unknown>> = [];
    const runs = new Map<string, any>();
    const db = {
      workflows: {
        run: vi.fn(async (input: Record<string, unknown>) => {
          workflowCalls.push(input);
          return {
            flow: { id: "flow_knowledge_retrieve", type: "flow" },
            run: { id: "workflow_run_1", status: "completed", workflowId: "flow_knowledge_retrieve" },
            step: {
              kind: "completed",
              nodeId: "end",
              bag: { keys: {
                hits: [{
                  id: "memory_1",
                  rawText: "The user prefers concise status updates.",
                  scope: { kind: "personal", ownerId: "alice" },
                  score: 0.91
                }]
              } }
            },
            nodeRuns: []
          };
        })
      },
      entities: { list: vi.fn(async () => []) },
      agentRuns: {
        get: vi.fn(async (id: string) => runs.get(id) ?? null),
        create: vi.fn(async (run: any) => { runs.set(run.id, run); return run; }),
        update: vi.fn(async (run: any) => { runs.set(run.id, run); return run; }),
        finish: vi.fn(async (run: any) => { runs.set(run.id, run); return run; }),
        createEvent: vi.fn(async (event: any) => event)
      }
    } as any;

    vi.stubEnv("PROJECTPLANER_PRINCIPAL_ID", "alice");
    vi.stubEnv("PROJECTPLANER_KNOWLEDGE_DATASET", "project-plan");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ type: "complete", result: "grounded result" }) } }]
    }), { status: 200, headers: { "content-type": "application/json" } })));

    try {
      const runtime = createAgentRuntime(db, "agent_1", "PLAN", profile(), {
        baseUrl: "http://llm.test",
        model: "fixture"
      });
      const result = await runtime.start({ agentId: "agent_1", task: "What does the user prefer?", projectKey: "PLAN" });

      expect(result.status).toBe("completed");
      expect(result.result).toBe("grounded result");
      expect(workflowCalls).toHaveLength(1);
      expect(workflowCalls[0]).toMatchObject({
        key: "knowledge_retrieve",
        projectKey: "PLAN",
        actor: "agent",
        bag: {
          datasetKey: "project-plan",
          query: "What does the user prefer?",
          access: { projectKey: "PLAN", includeGlobal: true, principalId: "alice" }
        }
      });
      expect(result.context?.sources).toEqual([expect.objectContaining({
        id: "memory:memory_1",
        type: "memory:personal"
      })]);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

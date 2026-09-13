import type { Entity, EntityRelation } from "../../../domain/types";
import type {
  AssistantContextPack,
  AssistantPendingDelegation,
  AssistantSession,
  AssistantTurnTrace
} from "../../../assistant/types";
import type { KnowledgeAccess } from "../../../knowledge";
import { emptySession } from "../../../assistant/parse";
import { projectAssistantTrace } from "../../../assistant/trace";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause, stepWorkflow } from "../../runtime";
import type { WorkflowAdapters, WorkflowStepResult } from "../../runtime";
import { assistantTurnGraph } from "./graph";

export type AssistantEvaluationLlmWrites = Record<
  string,
  Record<string, unknown> | Array<Record<string, unknown>>
>;

export type AssistantEvaluationCase = {
  id: string;
  message: string;
  projectKey?: string;
  knowledgeDataset?: string;
  knowledgeAccess?: KnowledgeAccess;
  session?: AssistantSession;
  pendingDelegation?: AssistantPendingDelegation;
  llmWrites: AssistantEvaluationLlmWrites;
  entities?: Entity[];
  relations?: EntityRelation[];
  adapters?: WorkflowAdapters;
  maxSteps?: number;
};

export type AssistantEvaluationResult = {
  caseId: string;
  runId: string;
  result: WorkflowStepResult;
  trace: AssistantTurnTrace;
};

function contextPack(projectKey: string, overrides: Partial<AssistantContextPack> = {}): AssistantContextPack {
  return {
    summary: { text: "Evaluation context" },
    topics: [],
    questions: [],
    context: { projectKey },
    ...overrides
  };
}

/** Small valid context-pack fixture for deterministic Assistant evaluations. */
export function assistantContextPackFixture(
  projectKey = "PLAN",
  overrides: Partial<AssistantContextPack> = {}
): Record<string, unknown> {
  return { contextPack: contextPack(projectKey, overrides) };
}

/** Build a complete route write while keeping irrelevant route fields null. */
export function assistantDecisionFixture(input: {
  route: "reply" | "clarify" | "retrieve" | "delegate" | "resume";
  reason: string;
  question?: string;
  lookupKind?: "agents" | "agent" | "entities" | "entity" | "workflows" | "neighborhood" | "knowledge_catalog" | "knowledge" | "files" | "file";
  lookupQuery?: string;
  lookupId?: string;
  lookupDatasetKey?: string;
  agentId?: string;
  task?: string;
  runId?: string;
  message?: string;
}): Record<string, unknown> {
  return {
    decision: {
      route: input.route,
      reason: input.reason,
      question: input.question ?? null,
      lookup: input.lookupKind
        ? {
            kind: input.lookupKind,
            query: input.lookupQuery ?? null,
            id: input.lookupId ?? null,
            ...(input.lookupDatasetKey ? { datasetKey: input.lookupDatasetKey } : {})
          }
        : null,
      lookupKind: input.lookupKind ?? null,
      lookupQuery: input.lookupQuery ?? null,
      lookupId: input.lookupId ?? null,
      ...(input.lookupDatasetKey ? { lookupDatasetKey: input.lookupDatasetKey } : {}),
      agentId: input.agentId ?? null,
      task: input.task ?? null,
      runId: input.runId ?? null,
      message: input.message ?? null
    }
  };
}

export function assistantReplyFixture(reply: string): Record<string, unknown> {
  return { reply };
}

function nextLlmWrites(
  writes: AssistantEvaluationLlmWrites,
  indexes: Map<string, number>,
  nodeId: string
): Record<string, unknown> {
  const configured = writes[nodeId];
  if (!configured) {
    throw new Error(`Assistant evaluation is missing deterministic LLM writes for '${nodeId}'.`);
  }
  if (Array.isArray(configured)) {
    const index = indexes.get(nodeId) ?? 0;
    const next = configured[index];
    if (!next) {
      throw new Error(`Assistant evaluation has no remaining LLM fixture for '${nodeId}'.`);
    }
    indexes.set(nodeId, index + 1);
    return next;
  }
  const index = indexes.get(nodeId) ?? 0;
  if (index > 0) {
    throw new Error(`Assistant evaluation reused single LLM fixture for '${nodeId}'.`);
  }
  indexes.set(nodeId, 1);
  return configured;
}

function terminalStatus(result: WorkflowStepResult): string {
  if (result.bag.status) {
    return result.bag.status;
  }
  return result.kind === "completed" ? "completed" : result.kind === "failed" ? "failed" : "running";
}

/** Execute the real assistant_turn graph with deterministic LLM writes. */
export async function runAssistantEvaluation(input: AssistantEvaluationCase): Promise<AssistantEvaluationResult> {
  const parsed = parseWorkflowGraph(assistantTurnGraph);
  if (!parsed.ok) {
    throw new Error(`assistant_turn graph is invalid: ${parsed.errors.join("; ")}`);
  }

  const projectKey = input.projectKey ?? input.session?.context.projectKey ?? "PLAN";
  const session = input.session ?? emptySession(projectKey);
  const runId = `assistant-eval-${input.id}`;
  const bag = createContextBag({
    workflowId: "flow_assistant_turn",
    runId,
    goal: "assistant evaluation",
    startNodeId: "start",
    actor: "assistant",
    keys: {
      projectKey,
      knowledgeDataset: input.knowledgeDataset ?? `project-${projectKey.toLowerCase()}`,
      ...(input.knowledgeAccess ? { knowledgeAccess: input.knowledgeAccess } : {}),
      session,
      message: input.message,
      ...(input.pendingDelegation ?? session.pendingDelegation
        ? { pendingDelegation: input.pendingDelegation ?? session.pendingDelegation }
        : {})
    }
  });
  const adapters = input.adapters ?? {};
  const indexes = new Map<string, number>();
  const maxSteps = input.maxSteps ?? 200;
  let result = await runWorkflowUntilPause({
    graph: parsed.graph,
    bag,
    adapters,
    entities: input.entities,
    relations: input.relations,
    maxSteps
  });

  for (let step = 0; step < maxSteps && result.kind === "pending_llm"; step += 1) {
    const writes = nextLlmWrites(input.llmWrites, indexes, result.nodeId ?? "");
    result = await stepWorkflow({
      graph: parsed.graph,
      bag: result.bag,
      adapters,
      entities: input.entities,
      relations: input.relations,
      llmWrites: writes
    });
    if (result.kind === "advanced") {
      result = await runWorkflowUntilPause({
        graph: parsed.graph,
        bag: result.bag,
        adapters,
        entities: input.entities,
        relations: input.relations,
        maxSteps
      });
    }
  }

  const history = result.bag.history ?? [];
  const trace = projectAssistantTrace({
    id: runId,
    status: terminalStatus(result),
    definitionSnapshot: parsed.graph,
    bag: result.bag,
    ...(result.kind === "failed" || result.bag.error
      ? { error: result.message ?? result.bag.error }
      : {}),
    startedAt: history[0]?.createdAt ?? new Date(0).toISOString(),
    ...(result.kind === "completed" || result.kind === "failed"
      ? { finishedAt: history.at(-1)?.createdAt ?? new Date(0).toISOString() }
      : {})
  });

  return { caseId: input.id, runId, result, trace };
}

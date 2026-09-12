/** Conversation document — not a graph entity. */

export type AssistantMessageRole = "user" | "assistant";

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
  /** Persisted link to the workflow run that produced an Assistant reply. */
  workflowRunId?: string;
};

export type AssistantTopicStatus = "active" | "parked";

export type AssistantTopic = {
  id: string;
  title: string;
  status: AssistantTopicStatus;
  /** 0–1 relevance. */
  weight: number;
  why?: string;
  entityId?: string;
};

/** Patch may omit id; merge assigns one. */
export type AssistantTopicDraft = {
  id?: string;
  title: string;
  status?: AssistantTopicStatus;
  weight?: number;
  why?: string;
  entityId?: string;
};

export type AssistantQuestionStatus = "open" | "answered";

export type AssistantQuestion = {
  id: string;
  text: string;
  status: AssistantQuestionStatus;
  answer?: string;
  topicId?: string;
};

export type AssistantQuestionDraft = {
  id?: string;
  text: string;
  status?: AssistantQuestionStatus;
  answer?: string;
  topicId?: string;
};

export type AssistantSummary = {
  text: string;
};

export type AssistantContext = {
  projectKey: string;
  flowId?: string;
  nodeId?: string;
  entityId?: string;
};

export type AssistantPendingDelegation = {
  runId: string;
  agentId: string;
  task: string;
  question?: string;
};

export type AssistantSession = {
  messages: AssistantMessage[];
  summary?: AssistantSummary;
  topics: AssistantTopic[];
  questions: AssistantQuestion[];
  context: AssistantContext;
  pendingDelegation?: AssistantPendingDelegation;
};

export type AssistantPatch = {
  summary?: AssistantSummary;
  topics?: AssistantTopicDraft[];
  questions?: AssistantQuestionDraft[];
  context?: Partial<Omit<AssistantContext, "projectKey">> & { projectKey?: string };
};

export type AssistantTurnOutput = {
  text: string;
  patch?: AssistantPatch;
};

/** Start inputs for the assistant_turn preset. */
export type AssistantTurnStart = {
  session: AssistantSession;
  message: string;
  /** Default 5, min 1. */
  windowSize?: number;
};

/** Step 1 — current document, before this turn’s rewrite. */
export type AssistantSessionPrior = {
  priorSummary?: AssistantSummary;
  priorTopics: AssistantTopic[];
  priorQuestions: AssistantQuestion[];
  priorContext: AssistantContext;
};

/** Transcript views from assistant_session. */
export type AssistantTurnWindow = {
  allTurns: AssistantMessage[];
  recentTurns: AssistantMessage[];
};

/** Turn A — assistant_context_v2 */
export type AssistantContextPack = {
  summary: AssistantSummary;
  topics: AssistantTopic[];
  questions: AssistantQuestion[];
  context: AssistantContext;
};

export type AssistantReply = string;

export type AssistantTraceRunStatus = "running" | "pending_llm" | "pending_user" | "waiting" | "completed" | "failed" | "cancelled";
export type AssistantTraceStepStatus = "completed" | "waiting" | "failed";

export type AssistantTraceStep = {
  nodeId: string;
  title: string;
  type: string;
  visit: number;
  status: AssistantTraceStepStatus;
  createdAt: string;
};

export type AssistantTurnTrace = {
  runId: string;
  status: AssistantTraceRunStatus;
  startedAt: string;
  finishedAt?: string;
  steps: AssistantTraceStep[];
  route?: AssistantRoute["route"];
  lookupKind?: NonNullable<AssistantRoute["lookupKind"]>;
  delegation?: {
    agentId?: string;
    status?: string;
  };
  error?: string;
};

/** Later, between A and B */
export type AssistantRoute = {
  route: "reply" | "clarify" | "retrieve" | "delegate" | "resume";
  reason: string;
  question?: string;
  lookup?: {
    kind: "agents" | "agent" | "entities" | "entity" | "workflows" | "neighborhood";
    query?: string;
    id?: string;
  };
  lookupKind?: "agents" | "agent" | "entities" | "entity" | "workflows" | "neighborhood";
  lookupQuery?: string;
  lookupId?: string;
  agentId?: string;
  task?: string;
  runId?: string;
  message?: string;
};

export type AssistantSessionStatus = "active" | "archived";

export type AssistantSessionRecord = {
  id: string;
  projectId: string;
  title: string;
  status: AssistantSessionStatus;
  session: AssistantSession;
  contextEntityId: string | null;
  createdAt: string;
  updatedAt: string;
};

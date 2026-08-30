/** Conversation document — not a graph entity. */

export type AssistantMessageRole = "user" | "assistant";

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
};

export type AssistantTopic = {
  id: string;
  title: string;
  why?: string;
  entityId?: string;
};

/** Patch may omit id; merge assigns one. */
export type AssistantTopicDraft = {
  id?: string;
  title: string;
  why?: string;
  entityId?: string;
};

export type AssistantSummary = {
  text: string;
  settled?: string[];
  open?: string[];
};

export type AssistantContext = {
  projectKey: string;
  flowId?: string;
  nodeId?: string;
  entityId?: string;
};

export type AssistantSession = {
  messages: AssistantMessage[];
  summary?: AssistantSummary;
  currentTopic?: AssistantTopic;
  topics: AssistantTopic[];
  context: AssistantContext;
};

export type AssistantPatch = {
  summary?: AssistantSummary;
  currentTopic?: AssistantTopicDraft | null;
  topics?: AssistantTopicDraft[];
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
  priorCurrentTopic?: AssistantTopic;
  priorTopics: AssistantTopic[];
  priorContext: AssistantContext;
};

/** Step 2 — transcript window only. */
export type AssistantTurnWindow = {
  recentTurns: AssistantMessage[];
};

/** Turn A — assistant_context_v1 */
export type AssistantContextPack = {
  summary: AssistantSummary;
  currentTopic: AssistantTopic | null;
  topics: AssistantTopic[];
  context: AssistantContext;
  topicChanged: boolean;
  focus?: string;
};

export type AssistantReply = string;

/** Later, between A and B */
export type AssistantRoute = {
  route: "reply" | "clarify" | "load_entity";
  reason?: string;
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

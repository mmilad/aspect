/** Conversation document — not a graph entity. */

export type AssistantMessageRole = "user" | "assistant";

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
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

export type AssistantSession = {
  messages: AssistantMessage[];
  summary?: AssistantSummary;
  topics: AssistantTopic[];
  questions: AssistantQuestion[];
  context: AssistantContext;
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

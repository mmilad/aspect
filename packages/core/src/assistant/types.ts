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

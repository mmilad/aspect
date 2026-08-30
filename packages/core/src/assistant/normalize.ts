import type {
  AssistantQuestion,
  AssistantQuestionDraft,
  AssistantSession,
  AssistantTopic,
  AssistantTopicDraft,
  AssistantTopicStatus
} from "./types";

export function clampWeight(value: unknown, fallback = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

export function topicStatus(value: unknown): AssistantTopicStatus {
  return value === "parked" ? "parked" : "active";
}

function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${uuid}`;
}

export function topicKey(topic: { id?: string; title: string }): string {
  return topic.id?.trim() || topic.title.trim().toLowerCase();
}

export function questionKey(question: { id?: string; text: string }): string {
  return question.id?.trim() || question.text.trim().toLowerCase();
}

export function withTopicId(topic: AssistantTopicDraft): AssistantTopic {
  const next: AssistantTopic = {
    id: topic.id?.trim() || newId("topic"),
    title: topic.title.trim(),
    status: topic.status === "parked" ? "parked" : "active",
    weight: clampWeight(topic.weight, 1)
  };
  if (topic.why !== undefined) {
    next.why = topic.why;
  }
  if (topic.entityId) {
    next.entityId = topic.entityId;
  }
  return next;
}

export function withQuestionId(question: AssistantQuestionDraft): AssistantQuestion {
  const next: AssistantQuestion = {
    id: question.id?.trim() || newId("question"),
    text: question.text.trim(),
    status: question.status === "answered" ? "answered" : "open"
  };
  if (question.answer !== undefined) {
    next.answer = question.answer;
  }
  if (question.topicId) {
    next.topicId = question.topicId;
  }
  return next;
}

function byWeightDesc(left: AssistantTopic, right: AssistantTopic): number {
  return right.weight - left.weight;
}

/** Active by weight desc, then parked by weight desc. */
export function normalizeTopics(topics: AssistantTopicDraft[]): AssistantTopic[] {
  const items = topics.map(withTopicId);
  const active = items.filter((topic) => topic.status === "active").sort(byWeightDesc);
  const parked = items.filter((topic) => topic.status === "parked").sort(byWeightDesc);
  return [...active, ...parked];
}

/** Open first, then answered. */
export function normalizeQuestions(questions: AssistantQuestionDraft[]): AssistantQuestion[] {
  const items = questions.map(withQuestionId);
  return [
    ...items.filter((question) => question.status === "open"),
    ...items.filter((question) => question.status === "answered")
  ];
}

export function normalizeSession(session: AssistantSession): AssistantSession {
  return {
    ...session,
    topics: normalizeTopics(session.topics),
    questions: normalizeQuestions(session.questions),
    context: { ...session.context }
  };
}

/** Pack rewrite plus prior topics the model omitted — parked, never deleted. */
export function retainOmittedTopics(prior: AssistantTopic[], incoming: AssistantTopic[]): AssistantTopic[] {
  const keys = new Set(incoming.map(topicKey));
  const omitted = prior
    .filter((topic) => !keys.has(topicKey(topic)))
    .map((topic) => ({ ...topic, status: "parked" as const }));
  return [...incoming, ...omitted];
}

/** Pack rewrite plus prior questions the model omitted — kept, never deleted. */
export function retainOmittedQuestions(
  prior: AssistantQuestion[],
  incoming: AssistantQuestion[]
): AssistantQuestion[] {
  const keys = new Set(incoming.map(questionKey));
  const omitted = prior.filter((question) => !keys.has(questionKey(question)));
  return [...incoming, ...omitted];
}

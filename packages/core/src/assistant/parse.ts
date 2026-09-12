import {
  clampWeight,
  normalizeQuestions,
  normalizeSession,
  normalizeTopics,
  questionKey,
  topicKey,
  topicStatus
} from "./normalize";
import type {
  AssistantContext,
  AssistantContextPack,
  AssistantMessage,
  AssistantPatch,
  AssistantQuestion,
  AssistantQuestionDraft,
  AssistantRoute,
  AssistantSession,
  AssistantSummary,
  AssistantTopic,
  AssistantTurnOutput
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function parseAssistantRoute(value: unknown): AssistantRoute | null {
  if (!isRecord(value) || typeof value.route !== "string" || typeof value.reason !== "string" || !value.reason.trim()) return null;
  if (!["reply", "clarify", "retrieve", "delegate", "resume"].includes(value.route)) return null;
  const route = value.route as AssistantRoute["route"];
  const result: AssistantRoute = { route, reason: value.reason.trim() };
  const optionalString = (key: string) => typeof value[key] === "string" && value[key].trim() ? value[key].trim() : undefined;
  const question = optionalString("question");
  const agentId = optionalString("agentId");
  const task = optionalString("task");
  const runId = optionalString("runId");
  const message = optionalString("message");
  const lookupKind = optionalString("lookupKind") as AssistantRoute["lookupKind"];
  const lookupQuery = optionalString("lookupQuery");
  const lookupId = optionalString("lookupId");
  if (question) result.question = question;
  if (agentId) result.agentId = agentId;
  if (task) result.task = task;
  if (runId) result.runId = runId;
  if (message) result.message = message;
  if (lookupKind) {
    if (!["agents", "agent", "entities", "entity", "workflows", "neighborhood", "knowledge"].includes(lookupKind)) return null;
    result.lookupKind = lookupKind;
    if (lookupQuery) result.lookupQuery = lookupQuery;
    if (lookupId) result.lookupId = lookupId;
    result.lookup = { kind: lookupKind, ...(lookupQuery ? { query: lookupQuery } : {}), ...(lookupId ? { id: lookupId } : {}) };
  }
  if (route === "clarify" && !question) return null;
  if (route === "retrieve" && !lookupKind) return null;
  if (route === "retrieve" && lookupKind && ["agent", "entity", "neighborhood"].includes(lookupKind) && !lookupId) return null;
  if (route === "retrieve" && lookupKind === "entities" && !lookupQuery) return null;
  if (route === "retrieve" && lookupKind === "knowledge" && !lookupQuery) return null;
  if (route === "delegate" && (!agentId || !task)) return null;
  if (route === "resume" && (!runId || !message)) return null;
  return result;
}

function isLegacyTopicRecord(value: Record<string, unknown>): boolean {
  return !("status" in value) && !("weight" in value);
}

export function emptySession(projectKey: string): AssistantSession {
  return {
    messages: [],
    topics: [],
    questions: [],
    context: { projectKey }
  };
}

export function parseMessage(value: unknown): AssistantMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const role = value.role === "user" || value.role === "assistant" ? value.role : null;
  const content = asString(value.content);
  const createdAt = asString(value.createdAt);
  if (!id || !role || content === undefined || !createdAt) {
    return null;
  }
  const workflowRunId = role === "assistant" ? asString(value.workflowRunId)?.trim() : undefined;
  return { id, role, content, createdAt, ...(workflowRunId ? { workflowRunId } : {}) };
}

export function parseTopic(
  value: unknown,
  options?: { defaultWeight?: number }
): AssistantTopic | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = asString(value.title);
  if (!title?.trim()) {
    return null;
  }
  const id = asString(value.id);
  const defaultWeight = options?.defaultWeight ?? 1;
  const topic: AssistantTopic = {
    id: id?.trim() || "",
    title: title.trim(),
    status: topicStatus(value.status),
    weight: clampWeight(value.weight, defaultWeight)
  };
  const why = asString(value.why);
  if (why !== undefined) {
    topic.why = why;
  }
  const entityId = asString(value.entityId);
  if (entityId) {
    topic.entityId = entityId;
  }
  return topic;
}

export function parseQuestion(value: unknown): AssistantQuestion | null {
  if (!isRecord(value)) {
    return null;
  }
  const text = asString(value.text);
  if (!text?.trim()) {
    return null;
  }
  const id = asString(value.id);
  const question: AssistantQuestion = {
    id: id?.trim() || "",
    text: text.trim(),
    status: value.status === "answered" ? "answered" : "open"
  };
  const answer = asString(value.answer);
  if (answer !== undefined) {
    question.answer = answer;
  }
  const topicId = asString(value.topicId);
  if (topicId) {
    question.topicId = topicId;
  }
  return question;
}

export function parseSummary(value: unknown): AssistantSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const text = asString(value.text);
  if (!text?.trim()) {
    return null;
  }
  return { text: text.trim() };
}

export function parseContext(value: unknown, fallbackProjectKey: string): AssistantContext {
  if (!isRecord(value)) {
    return { projectKey: fallbackProjectKey };
  }
  const projectKey = asString(value.projectKey)?.trim() || fallbackProjectKey;
  const context: AssistantContext = { projectKey };
  const flowId = asString(value.flowId);
  if (flowId) {
    context.flowId = flowId;
  }
  const nodeId = asString(value.nodeId);
  if (nodeId) {
    context.nodeId = nodeId;
  }
  const entityId = asString(value.entityId);
  if (entityId) {
    context.entityId = entityId;
  }
  return context;
}

function foldCurrentTopic(topics: AssistantTopic[], current: AssistantTopic): AssistantTopic[] {
  const folded: AssistantTopic = { ...current, status: "active", weight: 1 };
  const key = topicKey(folded);
  const index = topics.findIndex((topic) => topicKey(topic) === key);
  if (index >= 0) {
    const existing = topics[index]!;
    const next = [...topics];
    next[index] = { ...existing, ...folded, id: existing.id || folded.id };
    return next;
  }
  return [...topics, folded];
}

function migrateSummaryChips(
  rawSummary: unknown,
  questions: AssistantQuestionDraft[]
): AssistantQuestionDraft[] {
  if (!isRecord(rawSummary)) {
    return questions;
  }
  const seen = new Set(questions.map((question) => questionKey(question)));
  const next = [...questions];
  for (const text of asStringArray(rawSummary.open) ?? []) {
    const trimmed = text.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ text: trimmed, status: "open" });
  }
  for (const text of asStringArray(rawSummary.settled) ?? []) {
    const trimmed = text.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push({ text: trimmed, status: "answered" });
  }
  return next;
}

export function parseSession(value: unknown, fallbackProjectKey = ""): AssistantSession {
  if (!isRecord(value)) {
    return emptySession(fallbackProjectKey);
  }
  const context = parseContext(value.context, fallbackProjectKey);
  const messages = Array.isArray(value.messages)
    ? value.messages.map(parseMessage).filter((item): item is AssistantMessage => item !== null)
    : [];
  let topics = Array.isArray(value.topics)
    ? value.topics
        .map((raw) => {
          const defaultWeight = isRecord(raw) && isLegacyTopicRecord(raw) ? 0.5 : 1;
          return parseTopic(raw, { defaultWeight });
        })
        .filter((item): item is AssistantTopic => item !== null)
    : [];
  const currentTopic = parseTopic(value.currentTopic, { defaultWeight: 1 });
  if (currentTopic) {
    topics = foldCurrentTopic(topics, currentTopic);
  }
  let questions: AssistantQuestionDraft[] = Array.isArray(value.questions)
    ? value.questions.map(parseQuestion).filter((item): item is AssistantQuestion => item !== null)
    : [];
  questions = migrateSummaryChips(value.summary, questions);
  const session: AssistantSession = {
    messages,
    topics,
    questions: questions as AssistantQuestion[],
    context
  };
  if (
    isRecord(value.pendingDelegation) &&
    typeof value.pendingDelegation.runId === "string" &&
    typeof value.pendingDelegation.agentId === "string" &&
    typeof value.pendingDelegation.task === "string"
  ) {
    session.pendingDelegation = {
      runId: value.pendingDelegation.runId,
      agentId: value.pendingDelegation.agentId,
      task: value.pendingDelegation.task,
      ...(typeof value.pendingDelegation.question === "string"
        ? { question: value.pendingDelegation.question }
        : {})
    };
  }
  const summary = parseSummary(value.summary);
  if (summary) {
    session.summary = summary;
  }
  return normalizeSession(session);
}

export function parsePatch(value: unknown): AssistantPatch {
  if (!isRecord(value)) {
    return {};
  }
  const patch: AssistantPatch = {};
  if (value.summary !== undefined) {
    const summary = parseSummary(value.summary);
    if (summary) {
      patch.summary = summary;
    }
  }
  if (Array.isArray(value.topics)) {
    patch.topics = value.topics
      .map((raw) => parseTopic(raw))
      .filter((item): item is AssistantTopic => item !== null);
  }
  if (Array.isArray(value.questions)) {
    patch.questions = value.questions
      .map(parseQuestion)
      .filter((item): item is AssistantQuestion => item !== null);
  }
  if (isRecord(value.context)) {
    const context: AssistantPatch["context"] = {};
    const projectKey = asString(value.context.projectKey);
    if (projectKey) {
      context.projectKey = projectKey;
    }
    const flowId = asString(value.context.flowId);
    if (flowId !== undefined) {
      context.flowId = flowId;
    }
    const nodeId = asString(value.context.nodeId);
    if (nodeId !== undefined) {
      context.nodeId = nodeId;
    }
    const entityId = asString(value.context.entityId);
    if (entityId !== undefined) {
      context.entityId = entityId;
    }
    patch.context = context;
  }
  return patch;
}

export function parseContextPack(value: unknown, fallbackProjectKey = ""): AssistantContextPack | null {
  if (!isRecord(value)) {
    return null;
  }
  const summary = parseSummary(value.summary);
  if (!summary) {
    return null;
  }
  if (!Array.isArray(value.topics)) {
    return null;
  }
  let topics = value.topics.map((raw) => parseTopic(raw)).filter((item): item is AssistantTopic => item !== null);
  const currentTopic = parseTopic(value.currentTopic, { defaultWeight: 1 });
  if (currentTopic) {
    topics = foldCurrentTopic(topics, currentTopic);
  }
  let questions: AssistantQuestionDraft[] = Array.isArray(value.questions)
    ? value.questions.map(parseQuestion).filter((item): item is AssistantQuestion => item !== null)
    : [];
  questions = migrateSummaryChips(value.summary, questions);
  return {
    summary,
    topics: normalizeTopics(topics),
    questions: normalizeQuestions(questions),
    context: parseContext(value.context, fallbackProjectKey)
  };
}

export function parseTurnOutput(value: unknown): AssistantTurnOutput | null {
  if (!isRecord(value)) {
    return null;
  }
  const text = asString(value.text);
  if (text === undefined) {
    return null;
  }
  const output: AssistantTurnOutput = { text };
  if (value.patch !== undefined) {
    output.patch = parsePatch(value.patch);
  }
  return output;
}

export function titleFromSession(session: AssistantSession): string {
  const fromSummary = session.summary?.text?.trim();
  if (fromSummary) {
    return fromSummary.slice(0, 80);
  }
  const fromTopic = session.topics.find((topic) => topic.status === "active")?.title.trim();
  if (fromTopic) {
    return fromTopic;
  }
  const firstUser = session.messages.find((message) => message.role === "user")?.content.trim();
  if (firstUser) {
    return firstUser.slice(0, 80);
  }
  return "Assistant";
}

import type {
  AssistantContext,
  AssistantMessage,
  AssistantPatch,
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
  const items = value.filter((item): item is string => typeof item === "string");
  return items;
}

export function emptySession(projectKey: string): AssistantSession {
  return {
    messages: [],
    topics: [],
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
  return { id, role, content, createdAt };
}

export function parseTopic(value: unknown): AssistantTopic | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = asString(value.title);
  if (!title?.trim()) {
    return null;
  }
  const id = asString(value.id);
  const topic: AssistantTopic = { id: id?.trim() || "", title: title.trim() };
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

export function parseSummary(value: unknown): AssistantSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const text = asString(value.text);
  if (!text?.trim()) {
    return null;
  }
  const summary: AssistantSummary = { text: text.trim() };
  const settled = asStringArray(value.settled);
  if (settled && settled.length > 0) {
    summary.settled = settled;
  }
  const open = asStringArray(value.open);
  if (open && open.length > 0) {
    summary.open = open;
  }
  return summary;
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

export function parseSession(value: unknown, fallbackProjectKey = ""): AssistantSession {
  if (!isRecord(value)) {
    return emptySession(fallbackProjectKey);
  }
  const context = parseContext(value.context, fallbackProjectKey);
  const messages = Array.isArray(value.messages)
    ? value.messages.map(parseMessage).filter((item): item is AssistantMessage => item !== null)
    : [];
  const topics = Array.isArray(value.topics)
    ? value.topics.map(parseTopic).filter((item): item is AssistantTopic => item !== null)
    : [];
  const session: AssistantSession = { messages, topics, context };
  const summary = parseSummary(value.summary);
  if (summary) {
    session.summary = summary;
  }
  const currentTopic = parseTopic(value.currentTopic);
  if (currentTopic) {
    session.currentTopic = currentTopic;
  }
  return session;
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
  if (value.currentTopic === null) {
    patch.currentTopic = null;
  } else if (value.currentTopic !== undefined) {
    const topic = parseTopic(value.currentTopic);
    if (topic) {
      patch.currentTopic = topic;
    }
  }
  if (Array.isArray(value.topics)) {
    patch.topics = value.topics.map(parseTopic).filter((item): item is AssistantTopic => item !== null);
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
  const fromTopic = session.currentTopic?.title?.trim();
  if (fromTopic) {
    return fromTopic;
  }
  const firstUser = session.messages.find((message) => message.role === "user")?.content.trim();
  if (firstUser) {
    return firstUser.slice(0, 80);
  }
  return "Assistant";
}

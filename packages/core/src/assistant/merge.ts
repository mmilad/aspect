import { parsePatch } from "./parse";
import type { AssistantPatch, AssistantSession, AssistantTopic, AssistantTopicDraft } from "./types";

function newTopicId(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `topic_${uuid}`;
}

function topicKey(topic: AssistantTopicDraft): string {
  return topic.id || topic.title.trim().toLowerCase();
}

function withId(topic: AssistantTopicDraft): AssistantTopic {
  if (topic.id) {
    return { ...topic, id: topic.id };
  }
  return { ...topic, id: newTopicId() };
}

function mergeTopics(current: AssistantTopic[], incoming: AssistantTopicDraft[]): AssistantTopic[] {
  const byKey = new Map<string, AssistantTopic>();
  for (const topic of current) {
    byKey.set(topicKey(topic), topic);
  }
  for (const raw of incoming) {
    const topic = withId(raw);
    const key = topicKey(topic);
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...topic, id: existing.id } : topic);
  }
  return [...byKey.values()];
}

export function mergeSession(session: AssistantSession, patch: AssistantPatch): AssistantSession {
  const next: AssistantSession = {
    ...session,
    topics: [...session.topics],
    context: { ...session.context }
  };

  if (patch.summary) {
    next.summary = patch.summary;
  }

  if (patch.currentTopic === null) {
    delete next.currentTopic;
  } else if (patch.currentTopic) {
    next.currentTopic = withId(patch.currentTopic);
    next.topics = mergeTopics(next.topics, [next.currentTopic]);
  }

  if (patch.topics && patch.topics.length > 0) {
    next.topics = mergeTopics(next.topics, patch.topics.map(withId));
  }

  if (patch.context) {
    const { projectKey, flowId, nodeId, entityId } = patch.context;
    if (projectKey) {
      next.context.projectKey = projectKey;
    }
    if (flowId !== undefined) {
      if (flowId) {
        next.context.flowId = flowId;
      } else {
        delete next.context.flowId;
      }
    }
    if (nodeId !== undefined) {
      if (nodeId) {
        next.context.nodeId = nodeId;
      } else {
        delete next.context.nodeId;
      }
    }
    if (entityId !== undefined) {
      if (entityId) {
        next.context.entityId = entityId;
      } else {
        delete next.context.entityId;
      }
    }
  }

  return normalizeSession(next);
}

export function normalizeSession(session: AssistantSession): AssistantSession {
  const topics = session.topics.map(withId);
  const currentTopic = session.currentTopic ? withId(session.currentTopic) : undefined;
  const next: AssistantSession = { ...session, topics, context: { ...session.context } };
  if (currentTopic) {
    next.currentTopic = currentTopic;
  } else {
    delete next.currentTopic;
  }
  return next;
}

export function mergeSessionUnknown(session: AssistantSession, raw: unknown): AssistantSession {
  return mergeSession(session, parsePatch(raw));
}

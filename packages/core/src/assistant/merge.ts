import { appendMessage } from "./messages";
import {
  clampWeight,
  normalizeSession,
  questionKey,
  retainOmittedQuestions,
  retainOmittedTopics,
  topicKey,
  withQuestionId,
  withTopicId
} from "./normalize";
import { parsePatch } from "./parse";
import type {
  AssistantContextPack,
  AssistantPatch,
  AssistantQuestion,
  AssistantQuestionDraft,
  AssistantSession,
  AssistantTopic,
  AssistantTopicDraft
} from "./types";

function overlayTopic(existing: AssistantTopic, raw: AssistantTopicDraft): AssistantTopic {
  const next: AssistantTopic = { ...existing, title: raw.title.trim() || existing.title };
  if (raw.status) {
    next.status = raw.status;
  }
  if (raw.weight !== undefined) {
    next.weight = clampWeight(raw.weight, existing.weight);
  }
  if (raw.why !== undefined) {
    next.why = raw.why;
  }
  if (raw.entityId !== undefined) {
    if (raw.entityId) {
      next.entityId = raw.entityId;
    } else {
      delete next.entityId;
    }
  }
  return next;
}

function overlayQuestion(existing: AssistantQuestion, raw: AssistantQuestionDraft): AssistantQuestion {
  const next: AssistantQuestion = { ...existing, text: raw.text.trim() || existing.text };
  if (raw.status) {
    next.status = raw.status;
  }
  if (raw.answer !== undefined) {
    next.answer = raw.answer;
  }
  if (raw.topicId !== undefined) {
    if (raw.topicId) {
      next.topicId = raw.topicId;
    } else {
      delete next.topicId;
    }
  }
  return next;
}

function mergeTopics(current: AssistantTopic[], incoming: AssistantTopicDraft[]): AssistantTopic[] {
  const byKey = new Map<string, AssistantTopic>();
  for (const topic of current) {
    byKey.set(topicKey(topic), topic);
  }
  for (const raw of incoming) {
    const key = topicKey(raw);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, overlayTopic(existing, raw));
    } else {
      const topic = withTopicId(raw);
      byKey.set(topicKey(topic), topic);
    }
  }
  return [...byKey.values()];
}

function mergeQuestions(
  current: AssistantQuestion[],
  incoming: AssistantQuestionDraft[]
): AssistantQuestion[] {
  const byKey = new Map<string, AssistantQuestion>();
  for (const question of current) {
    byKey.set(questionKey(question), question);
  }
  for (const raw of incoming) {
    const key = questionKey(raw);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, overlayQuestion(existing, raw));
    } else {
      const question = withQuestionId(raw);
      byKey.set(questionKey(question), question);
    }
  }
  return [...byKey.values()];
}

export function mergeSession(session: AssistantSession, patch: AssistantPatch): AssistantSession {
  const next: AssistantSession = {
    ...session,
    topics: [...session.topics],
    questions: [...session.questions],
    context: { ...session.context }
  };

  if (patch.summary) {
    next.summary = patch.summary;
  }

  if (patch.topics && patch.topics.length > 0) {
    next.topics = mergeTopics(next.topics, patch.topics);
  }

  if (patch.questions && patch.questions.length > 0) {
    next.questions = mergeQuestions(next.questions, patch.questions);
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

export { normalizeSession } from "./normalize";

export function mergeSessionUnknown(session: AssistantSession, raw: unknown): AssistantSession {
  return mergeSession(session, parsePatch(raw));
}

/** Replace standing fields with the Turn A pack. Does not touch messages. Never deletes topics/questions. */
export function applyContextPack(session: AssistantSession, pack: AssistantContextPack): AssistantSession {
  const topics = retainOmittedTopics(session.topics, pack.topics.map(withTopicId));
  const questions = retainOmittedQuestions(session.questions, pack.questions.map(withQuestionId));
  return normalizeSession({
    ...session,
    summary: pack.summary,
    topics,
    questions,
    context: {
      ...pack.context,
      projectKey: pack.context.projectKey || session.context.projectKey
    }
  });
}

/** Append this turn’s messages and apply the pack as the next standing picture. */
export function commitAssistantTurn(
  session: AssistantSession,
  message: string,
  pack: AssistantContextPack,
  reply: string
): AssistantSession {
  return appendMessage(applyContextPack(appendMessage(session, "user", message), pack), "assistant", reply);
}

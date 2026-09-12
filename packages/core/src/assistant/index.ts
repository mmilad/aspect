export type {
  AssistantContext,
  AssistantContextPack,
  AssistantPendingDelegation,
  AssistantMessage,
  AssistantMessageRole,
  AssistantPatch,
  AssistantQuestion,
  AssistantQuestionDraft,
  AssistantQuestionStatus,
  AssistantReply,
  AssistantRoute,
  AssistantTraceRunStatus,
  AssistantTraceStep,
  AssistantTraceStepStatus,
  AssistantSession,
  AssistantSessionPrior,
  AssistantSessionRecord,
  AssistantSessionStatus,
  AssistantSummary,
  AssistantTopic,
  AssistantTopicDraft,
  AssistantTopicStatus,
  AssistantTurnOutput,
  AssistantTurnStart,
  AssistantTurnTrace,
  AssistantTurnWindow
} from "./types";
export type { AssistantBlock, AssistantProperty, AssistantView } from "./views";

export {
  emptySession,
  parseContext,
  parseContextPack,
  parseAssistantRoute,
  parseMessage,
  parsePatch,
  parseQuestion,
  parseSession,
  parseSummary,
  parseTopic,
  parseTurnOutput,
  titleFromSession
} from "./parse";
export { appendMessage, newMessage } from "./messages";
export { mergeSession, mergeSessionUnknown, normalizeSession, applyContextPack, commitAssistantTurn } from "./merge";
export { ASSISTANT_TURN_SCHEMA, ASSISTANT_TURN_SCHEMA_NAME } from "./schema";
export {
  ASSISTANT_CONTEXT_V1_KEY,
  ASSISTANT_CONTEXT_V1_SCHEMA,
  ASSISTANT_CONTEXT_V2_KEY,
  ASSISTANT_CONTEXT_V2_SCHEMA
} from "./context-pack";
export {
  DEFAULT_ASSISTANT_WINDOW_SIZE,
  priorFromSession,
  requireAssistantSession,
  resolveWindowSize,
  sliceRecentTurns
} from "./window";
export {
  ASSISTANT_CATALOG,
  ASSISTANT_ITEM_VIEWS,
  ASSISTANT_QUESTION_BLOCKS,
  ASSISTANT_TOPIC_BLOCKS,
  propertyByKey,
  visibleNav
} from "./views";
export { ASSISTANT_ROLE_MANIFEST, serializeAssistantRoleManifest } from "./role";
export type { AssistantRoleManifest } from "./role";
export { projectAssistantTrace } from "./trace";

import { appendMessage, newMessage } from "./messages";
import { mergeSession, mergeSessionUnknown, normalizeSession, applyContextPack, commitAssistantTurn } from "./merge";
import {
  emptySession,
  parseContext,
  parseContextPack,
  parseAssistantRoute,
  parsePatch,
  parseSession,
  parseTurnOutput,
  titleFromSession
} from "./parse";
import { ASSISTANT_TURN_SCHEMA, ASSISTANT_TURN_SCHEMA_NAME } from "./schema";
import {
  ASSISTANT_CONTEXT_V1_KEY,
  ASSISTANT_CONTEXT_V1_SCHEMA,
  ASSISTANT_CONTEXT_V2_KEY,
  ASSISTANT_CONTEXT_V2_SCHEMA
} from "./context-pack";
import {
  DEFAULT_ASSISTANT_WINDOW_SIZE,
  priorFromSession,
  requireAssistantSession,
  resolveWindowSize,
  sliceRecentTurns
} from "./window";
import views from "./views";
import { getDataPath, pathIsNonempty, setDataPath } from "../json-path";

const assistant = {
  emptySession,
  parseAssistantRoute,
  parseSession,
  parsePatch,
  parseContext,
  parseTurnOutput,
  titleFromSession,
  merge: mergeSession,
  mergeUnknown: mergeSessionUnknown,
  normalize: normalizeSession,
  applyContextPack,
  commitAssistantTurn,
  parseContextPack,
  appendMessage,
  newMessage,
  schema: ASSISTANT_TURN_SCHEMA,
  schemaName: ASSISTANT_TURN_SCHEMA_NAME,
  contextPackKey: ASSISTANT_CONTEXT_V2_KEY,
  contextPackSchema: ASSISTANT_CONTEXT_V2_SCHEMA,
  contextPackKeyV1: ASSISTANT_CONTEXT_V1_KEY,
  contextPackSchemaV1: ASSISTANT_CONTEXT_V1_SCHEMA,
  defaultWindowSize: DEFAULT_ASSISTANT_WINDOW_SIZE,
  priorFromSession,
  requireAssistantSession,
  resolveWindowSize,
  sliceRecentTurns,
  views,
  path: { get: getDataPath, set: setDataPath, nonempty: pathIsNonempty }
};

export default assistant;

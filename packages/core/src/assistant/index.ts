export type {
  AssistantContext,
  AssistantMessage,
  AssistantMessageRole,
  AssistantPatch,
  AssistantSession,
  AssistantSessionRecord,
  AssistantSessionStatus,
  AssistantSummary,
  AssistantTopic,
  AssistantTopicDraft,
  AssistantTurnOutput
} from "./types";
export type { AssistantBlock, AssistantProperty, AssistantView } from "./views";

export {
  emptySession,
  parseContext,
  parseMessage,
  parsePatch,
  parseSession,
  parseSummary,
  parseTopic,
  parseTurnOutput,
  titleFromSession
} from "./parse";
export { appendMessage, newMessage } from "./messages";
export { mergeSession, mergeSessionUnknown, normalizeSession } from "./merge";
export { ASSISTANT_TURN_SCHEMA, ASSISTANT_TURN_SCHEMA_NAME } from "./schema";
export {
  ASSISTANT_CATALOG,
  ASSISTANT_ITEM_VIEWS,
  ASSISTANT_TOPIC_BLOCKS,
  propertyByKey,
  visibleNav
} from "./views";

import { appendMessage, newMessage } from "./messages";
import { mergeSession, mergeSessionUnknown, normalizeSession } from "./merge";
import {
  emptySession,
  parseContext,
  parsePatch,
  parseSession,
  parseTurnOutput,
  titleFromSession
} from "./parse";
import { ASSISTANT_TURN_SCHEMA, ASSISTANT_TURN_SCHEMA_NAME } from "./schema";
import views from "./views";
import { getDataPath, pathIsNonempty, setDataPath } from "../json-path";

const assistant = {
  emptySession,
  parseSession,
  parsePatch,
  parseContext,
  parseTurnOutput,
  titleFromSession,
  merge: mergeSession,
  mergeUnknown: mergeSessionUnknown,
  normalize: normalizeSession,
  appendMessage,
  newMessage,
  schema: ASSISTANT_TURN_SCHEMA,
  schemaName: ASSISTANT_TURN_SCHEMA_NAME,
  views,
  path: { get: getDataPath, set: setDataPath, nonempty: pathIsNonempty }
};

export default assistant;

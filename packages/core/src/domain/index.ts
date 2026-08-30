/**
 * Domain helpers: entity graph, search, status, narrative, candidacy.
 * Query compile/eval and PlanApi live on their own subpaths.
 */
export type * from "./entities";
export type * from "./compact-relations";
export type * from "./paths";
export type * from "./search";
export type * from "./status";
export type * from "./task-candidacy";
export type * from "./narrative";
export type * from "./types";

import {
  TASK_ANCHOR_RELATION_TYPES,
  TASK_CHAIN_RELATION_TYPES,
  TASK_ORDER_RELATION_TYPES,
  expandTaskChainIds,
  isTaskChainRelationType,
  isTaskOrderRelationType,
  selectCompactContextRelations
} from "./compact-relations";
import { getEntityById, getGenericEntityDependents, validateEntityGraph, validateEntityRef } from "./entities";
import { getNarrative, narrativeSearchValues, withNarrative } from "./narrative";
import { buildNodePath, slugifyTitle, uniqueSlug } from "./paths";
import {
  entitySearchValues,
  queryTokens,
  rankedByQuery,
  relevanceSearchValues,
  scoreSearch
} from "./search";
import {
  PROCESS_ENTITY_TYPES,
  PROCESS_RANK,
  allowedStatusesForType,
  decisionStatuses,
  defaultStatusForType,
  deriveParentProcessStatus,
  isParticipatingProcessStatus,
  isProcessEntityType,
  isProcessStatus,
  isStatusAllowedForType,
  migrateLegacyStatus,
  processStatuses,
  questionStatuses
} from "./status";
import {
  compactEntity,
  compactRelation,
  composeTaskPrompt,
  isBlockerResolved,
  isTaskCandidate,
  isTaskDisabled,
  isTaskUnblocked,
  lightSignals,
  neighborhoodContext,
  priorityWeight,
  rankTaskCandidates,
  taskPriority,
  workScore
} from "./task-candidacy";
import { nodeTypes, relationTypes } from "./types";

const domain = {
  getEntityById,
  getGenericEntityDependents,
  validateEntityGraph,
  validateEntityRef,
  expandTaskChainIds,
  isTaskChainRelationType,
  isTaskOrderRelationType,
  selectCompactContextRelations,
  TASK_ANCHOR_RELATION_TYPES,
  TASK_CHAIN_RELATION_TYPES,
  TASK_ORDER_RELATION_TYPES,
  slugifyTitle,
  buildNodePath,
  uniqueSlug,
  queryTokens,
  scoreSearch,
  rankedByQuery,
  entitySearchValues,
  relevanceSearchValues,
  processStatuses,
  decisionStatuses,
  questionStatuses,
  PROCESS_ENTITY_TYPES,
  PROCESS_RANK,
  isProcessEntityType,
  isProcessStatus,
  isParticipatingProcessStatus,
  allowedStatusesForType,
  isStatusAllowedForType,
  defaultStatusForType,
  migrateLegacyStatus,
  deriveParentProcessStatus,
  isTaskDisabled,
  taskPriority,
  priorityWeight,
  isBlockerResolved,
  isTaskUnblocked,
  isTaskCandidate,
  lightSignals,
  workScore,
  rankTaskCandidates,
  compactEntity,
  compactRelation,
  neighborhoodContext,
  composeTaskPrompt,
  getNarrative,
  withNarrative,
  narrativeSearchValues,
  nodeTypes,
  relationTypes
};

export default domain;

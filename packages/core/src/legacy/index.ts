/** Compatibility helpers for ProjectPlanSnapshot / ProjectNode shapes. Prefer domain Entity APIs. */
export type * from "./drafts";
export type * from "./relations";
export type * from "./task-planning";
export type * from "./templates";

import { detectDraftConflicts } from "./drafts";
import { focusGraph, isRelationType, scopedGraph, validateRelation } from "./relations";
import {
  getDescendantAspectIds,
  getEntityDependents,
  getEntityRelations,
  getNestedFeatureIds,
  getOpenWorkBelowAspect,
  getPrimaryTaskLink,
  getTagsForEntity,
  getTaskLinks,
  getTasksForAspect,
  getTasksForFeature,
  validateTaskLinks
} from "./task-planning";
import { getNodeTemplate, readTemplateValue } from "./templates";

const legacy = {
  detectDraftConflicts,
  isRelationType,
  validateRelation,
  scopedGraph,
  focusGraph,
  validateTaskLinks,
  getDescendantAspectIds,
  getNestedFeatureIds,
  getTaskLinks,
  getTasksForAspect,
  getTasksForFeature,
  getEntityRelations,
  getEntityDependents,
  getOpenWorkBelowAspect,
  getTagsForEntity,
  getPrimaryTaskLink,
  getNodeTemplate,
  readTemplateValue
};

export default legacy;
export {
  detectDraftConflicts,
  isRelationType,
  validateRelation,
  scopedGraph,
  focusGraph,
  validateTaskLinks,
  getDescendantAspectIds,
  getNestedFeatureIds,
  getTaskLinks,
  getTasksForAspect,
  getTasksForFeature,
  getEntityRelations,
  getEntityDependents,
  getOpenWorkBelowAspect,
  getTagsForEntity,
  getPrimaryTaskLink,
  getNodeTemplate,
  readTemplateValue
};

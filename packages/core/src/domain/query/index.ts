export * from "./types";
export * from "./expand";
export * from "./compile";
export * from "./evaluate";

import { compileExpandedFilter, compileListQuery, resolveAppliedFilter } from "./compile";
import { evaluatePlan, matchesPredicate } from "./evaluate";
import {
  BLOCKER_RESOLVED_FILTER,
  TASK_CANDIDATE_FILTER,
  UNBLOCKED_FILTER,
  expandNamedPredicates
} from "./expand";

const query = {
  compileListQuery,
  compileExpandedFilter,
  resolveAppliedFilter,
  evaluatePlan,
  matchesPredicate,
  expandNamedPredicates,
  BLOCKER_RESOLVED_FILTER,
  UNBLOCKED_FILTER,
  TASK_CANDIDATE_FILTER
};

export default query;

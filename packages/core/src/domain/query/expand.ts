import type { EntityFilter, FieldFilter } from "./types";

const CANDIDATE_STATUSES = ["in_planning", "planned", "in_progress"] as const;

/** Matches `isBlockerResolved` for the related (blocker) entity. */
export const BLOCKER_RESOLVED_FILTER: EntityFilter = {
  or: [
    { field: "metadata.disabled", op: "eq", value: true },
    {
      and: [
        { field: "type", op: "eq", value: "task" },
        { field: "status", op: "in", value: ["done", "canceled", "archived"] }
      ]
    },
    {
      and: [
        { field: "type", op: "eq", value: "decision" },
        { field: "status", op: "in", value: ["accepted", "rejected", "archived"] }
      ]
    },
    {
      and: [
        { field: "type", op: "eq", value: "question" },
        { field: "status", op: "in", value: ["answered", "archived"] }
      ]
    },
    {
      and: [
        { not: { field: "type", op: "in", value: ["task", "decision", "question"] } },
        { field: "status", op: "in", value: ["done", "canceled", "archived"] }
      ]
    }
  ]
};

/** Matches `isTaskUnblocked`: no unresolved outbound blocked_by edges. */
export const UNBLOCKED_FILTER: EntityFilter = {
  rel: {
    direction: "out",
    types: ["blocked_by"],
    every: BLOCKER_RESOLVED_FILTER
  }
};

export const TASK_CANDIDATE_FILTER: EntityFilter = {
  and: [
    { field: "type", op: "eq", value: "task" },
    { not: { field: "metadata.disabled", op: "eq", value: true } as FieldFilter },
    { field: "status", op: "in", value: [...CANDIDATE_STATUSES] },
    UNBLOCKED_FILTER
  ]
};

export function expandNamedPredicates(filter: EntityFilter): EntityFilter {
  if ("pred" in filter) {
    if (filter.pred === "unblocked") {
      return UNBLOCKED_FILTER;
    }
    if (filter.pred === "task_candidate") {
      return expandNamedPredicates(TASK_CANDIDATE_FILTER);
    }
    const _exhaustive: never = filter.pred;
    return _exhaustive;
  }

  if ("and" in filter) {
    return { and: filter.and.map(expandNamedPredicates) };
  }
  if ("or" in filter) {
    return { or: filter.or.map(expandNamedPredicates) };
  }
  if ("not" in filter) {
    return { not: expandNamedPredicates(filter.not) };
  }
  if ("rel" in filter) {
    const rel = filter.rel;
    return {
      rel: {
        ...rel,
        some: rel.some ? expandNamedPredicates(rel.some) : undefined,
        every: rel.every ? expandNamedPredicates(rel.every) : undefined,
        none: rel.none === true || rel.none === undefined ? rel.none : expandNamedPredicates(rel.none)
      }
    };
  }

  return filter;
}

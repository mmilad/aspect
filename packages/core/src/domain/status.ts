import type { EntityType } from "./types";

/** Aspect / Feature / Task process ladder (rollup participants). */
export const processStatuses = [
  "in_planning",
  "planned",
  "in_progress",
  "done",
  "canceled",
  "archived"
] as const;
export type ProcessStatus = (typeof processStatuses)[number];

/** Decision resolution (never drives parent rollup). */
export const decisionStatuses = ["open", "accepted", "rejected", "archived"] as const;
export type DecisionStatus = (typeof decisionStatuses)[number];

/** Question resolution. */
export const questionStatuses = ["open", "answered", "archived"] as const;
export type QuestionStatus = (typeof questionStatuses)[number];

export type EntityStatus = ProcessStatus | DecisionStatus | QuestionStatus;

export const PROCESS_ENTITY_TYPES = new Set<EntityType>(["aspect", "feature", "task"]);

const PROCESS_SET = new Set<string>(processStatuses);
const DECISION_SET = new Set<string>(decisionStatuses);
const QUESTION_SET = new Set<string>(questionStatuses);

/** Rank for least-advanced rollup (canceled/archived do not participate). */
export const PROCESS_RANK: Record<"in_planning" | "planned" | "in_progress" | "done", number> = {
  in_planning: 0,
  planned: 1,
  in_progress: 2,
  done: 3
};

export function isProcessEntityType(type: EntityType): boolean {
  return PROCESS_ENTITY_TYPES.has(type);
}

export function isProcessStatus(status: string): status is ProcessStatus {
  return PROCESS_SET.has(status);
}

export function isParticipatingProcessStatus(
  status: string
): status is "in_planning" | "planned" | "in_progress" | "done" {
  return status === "in_planning" || status === "planned" || status === "in_progress" || status === "done";
}

export function allowedStatusesForType(type: EntityType): readonly string[] {
  if (type === "decision") {
    return decisionStatuses;
  }
  if (type === "question") {
    return questionStatuses;
  }
  // aspect/feature/task and other nodes use the process ladder
  return processStatuses;
}

export function isStatusAllowedForType(type: EntityType, status: string): boolean {
  return allowedStatusesForType(type).includes(status);
}

export function defaultStatusForType(type: EntityType): EntityStatus {
  if (type === "decision" || type === "question") {
    return "open";
  }
  if (type === "task") {
    return "planned";
  }
  return "planned";
}

/** Map legacy stored statuses onto the locked model. */
export function migrateLegacyStatus(type: EntityType, status: string, metadata?: Record<string, unknown>): EntityStatus {
  if (type === "task" && metadata?.disabled === true) {
    return "canceled";
  }

  if (type === "decision") {
    switch (status) {
      case "accepted":
        return "accepted";
      case "rejected":
        return "rejected";
      case "archived":
        return "archived";
      case "planned":
      case "open":
      case "not_implemented":
      case "in_planning":
        return "open";
      default:
        return DECISION_SET.has(status) ? (status as DecisionStatus) : "open";
    }
  }

  if (type === "question") {
    switch (status) {
      case "answered":
        return "answered";
      case "archived":
        return "archived";
      case "accepted":
        return "answered";
      default:
        return QUESTION_SET.has(status) ? (status as QuestionStatus) : "open";
    }
  }

  switch (status) {
    case "todo":
      return "planned";
    case "doing":
    case "in_work":
    case "active":
    case "blocked":
    case "review":
      return "in_progress";
    case "implemented":
    case "done":
    case "answered":
    case "accepted":
      return "done";
    case "not_implemented":
      return "in_planning";
    case "planned":
      return "planned";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "archived":
      return "archived";
    case "in_planning":
    case "in_progress":
      return status;
    default:
      return PROCESS_SET.has(status) ? (status as ProcessStatus) : "planned";
  }
}

/**
 * Derive parent process status from first-level children.
 * - Ignore canceled/archived children.
 * - All participating done ⇒ done.
 * - Any incomplete ⇒ in_progress (new planned child still bumps parents).
 * - Never move backwards below in_progress once current is in_progress or done
 *   (done → in_progress allowed when incomplete children reappear).
 */
export function deriveParentProcessStatus(
  childStatuses: string[],
  currentParentStatus?: string
): ProcessStatus | null {
  const participating = childStatuses.filter(isParticipatingProcessStatus);
  if (participating.length === 0) {
    return null;
  }

  const derived: ProcessStatus = participating.every((status) => status === "done") ? "done" : "in_progress";
  const current =
    currentParentStatus && isParticipatingProcessStatus(currentParentStatus) ? currentParentStatus : null;

  if (!current) {
    return derived;
  }

  // Never drop below in_progress once there
  if (PROCESS_RANK[current] >= PROCESS_RANK.in_progress && PROCESS_RANK[derived] < PROCESS_RANK.in_progress) {
    return current;
  }

  return derived;
}

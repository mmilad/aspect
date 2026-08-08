import type { Entity, EntityRelation, TaskPriority } from "./types";

const CANDIDATE_STATUSES = new Set(["todo", "doing", "review"]);

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10
};

export interface RankedTaskCandidate {
  id: string;
  type: "task";
  key: string | null;
  title: string;
  status: string;
  summary: string;
  priority: TaskPriority;
  workScore: number;
}

export function isTaskDisabled(entity: Entity): boolean {
  return entity.metadata.disabled === true;
}

export function taskPriority(entity: Entity): TaskPriority {
  const value = entity.metadata.priority;
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return "medium";
}

export function priorityWeight(priority: TaskPriority): number {
  return PRIORITY_WEIGHT[priority];
}

/** Blocker no longer holds the dependent task. */
export function isBlockerResolved(entity: Entity): boolean {
  if (isTaskDisabled(entity)) {
    return true;
  }
  if (entity.type === "task") {
    return entity.status === "done";
  }
  if (entity.type === "decision" || entity.type === "question") {
    return entity.status === "accepted" || entity.status === "answered" || entity.status === "archived";
  }
  return entity.status === "implemented" || entity.status === "archived";
}

export function isTaskUnblocked(
  task: Entity,
  entitiesById: Map<string, Entity>,
  relations: EntityRelation[]
): boolean {
  const blockers = relations.filter(
    (relation) => relation.sourceEntityId === task.id && relation.type === "blocked_by"
  );
  if (blockers.length === 0) {
    return true;
  }
  return blockers.every((relation) => {
    const target = entitiesById.get(relation.targetEntityId);
    return target ? isBlockerResolved(target) : false;
  });
}

export function isTaskCandidate(
  task: Entity,
  entitiesById: Map<string, Entity>,
  relations: EntityRelation[]
): boolean {
  if (task.type !== "task") {
    return false;
  }
  if (isTaskDisabled(task)) {
    return false;
  }
  if (!CANDIDATE_STATUSES.has(task.status)) {
    return false;
  }
  return isTaskUnblocked(task, entitiesById, relations);
}

/** Small additives on top of priority weight. */
export function lightSignals(
  task: Entity,
  relations: EntityRelation[],
  options?: { criticalTaggedIds?: Set<string> }
): number {
  const outbound = relations.filter((relation) => relation.sourceEntityId === task.id).length;
  let score = Math.min(10, outbound);
  if (options?.criticalTaggedIds?.has(task.id)) {
    score += 5;
  }
  return score;
}

export function workScore(
  task: Entity,
  relations: EntityRelation[],
  options?: { criticalTaggedIds?: Set<string> }
): number {
  return priorityWeight(taskPriority(task)) + lightSignals(task, relations, options);
}

export function rankTaskCandidates(
  entities: Entity[],
  relations: EntityRelation[],
  options?: { criticalTaggedIds?: Set<string> }
): RankedTaskCandidate[] {
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const candidates = entities
    .filter((entity) => isTaskCandidate(entity, entitiesById, relations))
    .map((task) => {
      const priority = taskPriority(task);
      return {
        id: task.id,
        type: "task" as const,
        key: task.key,
        title: task.title,
        status: task.status,
        summary: task.summary,
        priority,
        workScore: workScore(task, relations, options)
      };
    });

  candidates.sort((a, b) => {
    if (b.workScore !== a.workScore) {
      return b.workScore - a.workScore;
    }
    const keyA = a.key ?? "";
    const keyB = b.key ?? "";
    if (keyA !== keyB) {
      return keyA.localeCompare(keyB);
    }
    return a.id.localeCompare(b.id);
  });

  return candidates;
}

export function compactEntity(entity: Entity) {
  return {
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    status: entity.status,
    summary: entity.summary
  };
}

export function compactRelation(relation: EntityRelation) {
  return {
    id: relation.id,
    from: relation.sourceEntityId,
    to: relation.targetEntityId,
    type: relation.type,
    primary: relation.isPrimary,
    label: relation.label
  };
}

/** 1-hop neighbors of a selected entity from an in-bag graph snapshot. */
export function neighborhoodContext(
  selectedId: string,
  entities: Entity[],
  relations: EntityRelation[]
): { entities: ReturnType<typeof compactEntity>[]; relations: ReturnType<typeof compactRelation>[] } {
  const neighborIds = new Set<string>([selectedId]);
  const adjacent = relations.filter(
    (relation) => relation.sourceEntityId === selectedId || relation.targetEntityId === selectedId
  );
  for (const relation of adjacent) {
    neighborIds.add(relation.sourceEntityId);
    neighborIds.add(relation.targetEntityId);
  }
  return {
    entities: entities.filter((entity) => neighborIds.has(entity.id)).map(compactEntity),
    relations: adjacent.map(compactRelation)
  };
}

export function composeTaskPrompt(input: {
  task: RankedTaskCandidate | Record<string, unknown>;
  context: { entities?: unknown[]; relations?: unknown[] } | unknown;
}): string {
  const task = input.task;
  const title = typeof task.title === "string" ? task.title : "Untitled task";
  const key = typeof task.key === "string" ? task.key : null;
  const status = typeof task.status === "string" ? task.status : "unknown";
  const priority = typeof task.priority === "string" ? task.priority : "medium";
  const summary = typeof task.summary === "string" ? task.summary : "";
  const workScoreValue = typeof task.workScore === "number" ? task.workScore : null;
  const id = typeof task.id === "string" ? task.id : "";

  const lines = [
    "You are picking up the next eligible Projectplaner task.",
    "",
    `Task: ${key ? `${key} — ` : ""}${title}`,
    `Id: ${id}`,
    `Status: ${status}`,
    `Priority: ${priority}${workScoreValue !== null ? ` (workScore ${workScoreValue})` : ""}`,
    summary ? `Summary: ${summary}` : null,
    "",
    "Graph context (1-hop neighborhood):",
    JSON.stringify(input.context, null, 2),
    "",
    "Work only on this task. Orient from the linked Aspect/Feature before broad repo reading.",
    "Leave compact results on the graph when done."
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

import {
  getPrimaryTaskLink,
  type Feature,
  type ProjectNode,
  type ProjectPlanSnapshot,
  type Task
} from "@projectplaner/core";

/** Process columns — statuses stay distinct (planned ≠ todo). */
export const kanbanColumns = [
  "not_implemented",
  "planned",
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done"
] as const;
export type KanbanColumnId = (typeof kanbanColumns)[number];

export const kanbanColumnLabel: Record<KanbanColumnId, string> = {
  not_implemented: "Not implemented",
  planned: "Planned",
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done"
};

export type KanbanCardKind = "aspect" | "feature" | "task";

export type KanbanCard = {
  id: string;
  kind: KanbanCardKind;
  key: string | null;
  title: string;
  status: string;
  column: KanbanColumnId;
  canEnter: boolean;
};

const COLUMN_RANK: Record<KanbanColumnId, number> = {
  not_implemented: 0,
  planned: 1,
  todo: 2,
  in_progress: 3,
  blocked: 4,
  review: 5,
  done: 6
};

const IN_FLIGHT: ReadonlySet<KanbanColumnId> = new Set(["in_progress", "blocked", "review"]);

export function statusToColumn(status: string): KanbanColumnId {
  switch (status) {
    case "not_implemented":
      return "not_implemented";
    case "planned":
      return "planned";
    case "todo":
      return "todo";
    case "doing":
    case "in_work":
    case "active":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "review":
    case "accepted":
      return "review";
    case "done":
    case "implemented":
    case "answered":
    case "archived":
      return "done";
    default:
      return "todo";
  }
}

/** Best matching stored status when dropping onto a column. */
export function columnToStatus(column: KanbanColumnId, kind: KanbanCardKind): string {
  if (kind === "task") {
    switch (column) {
      case "not_implemented":
      case "planned":
      case "todo":
        return "todo";
      case "in_progress":
        return "doing";
      case "blocked":
        return "blocked";
      case "review":
        return "review";
      case "done":
        return "done";
    }
  }

  switch (column) {
    case "not_implemented":
      return "not_implemented";
    case "planned":
    case "todo":
      return "planned";
    case "in_progress":
      return "in_work";
    case "blocked":
      return "blocked";
    case "review":
      return "accepted";
    case "done":
      return "implemented";
  }
}

export function deriveParentColumn(childColumns: KanbanColumnId[]): KanbanColumnId | null {
  if (childColumns.length === 0) {
    return null;
  }
  if (childColumns.some((column) => IN_FLIGHT.has(column))) {
    return "in_progress";
  }
  let least: KanbanColumnId = childColumns[0]!;
  for (const column of childColumns) {
    if (COLUMN_RANK[column] < COLUMN_RANK[least]) {
      least = column;
    }
  }
  return least;
}

function aspectCard(node: ProjectNode): KanbanCard {
  return {
    id: node.id,
    kind: "aspect",
    key: null,
    title: node.title,
    status: node.status,
    column: statusToColumn(node.status),
    canEnter: true
  };
}

function featureCard(feature: Feature): KanbanCard {
  return {
    id: feature.id,
    kind: "feature",
    key: feature.key,
    title: feature.title,
    status: feature.status,
    column: statusToColumn(feature.status),
    canEnter: true
  };
}

function taskCard(task: Task): KanbanCard {
  return {
    id: task.id,
    kind: "task",
    key: task.key,
    title: task.title,
    status: task.status,
    column: statusToColumn(task.status),
    canEnter: false
  };
}

/** Same root as graph focus (`snapshot.nodes[0]`). */
export function getKanbanProjectRoot(snapshot: ProjectPlanSnapshot): ProjectNode | null {
  return snapshot.nodes[0] ?? null;
}

/**
 * Root board: Aspects directly under the project root node (mirrors graph center at project).
 * Falls back to parentId===null Aspects if the root has no aspect children.
 */
export function listRootAspectCards(snapshot: ProjectPlanSnapshot): KanbanCard[] {
  const root = getKanbanProjectRoot(snapshot);
  const underRoot = root
    ? snapshot.nodes.filter((node) => node.type === "aspect" && node.parentId === root.id)
    : [];
  const aspects =
    underRoot.length > 0
      ? underRoot
      : snapshot.nodes.filter((node) => node.type === "aspect" && node.parentId === null);

  return aspects
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    .map(aspectCard);
}

/** Columns that currently have at least one card (before column visibility filter). */
export function usedKanbanColumns(cards: KanbanCard[]): KanbanColumnId[] {
  const used = new Set(cards.map((card) => card.column));
  return kanbanColumns.filter((column) => used.has(column));
}

function featuresForAspect(snapshot: ProjectPlanSnapshot, aspectId: string): Feature[] {
  const linkedIds = new Set(
    snapshot.featureAspectLinks.filter((link) => link.aspectId === aspectId).map((link) => link.featureId)
  );
  return snapshot.features
    .filter((feature) => linkedIds.has(feature.id) && feature.parentFeatureId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

function featuresForFeature(snapshot: ProjectPlanSnapshot, featureId: string): Feature[] {
  return snapshot.features
    .filter((feature) => feature.parentFeatureId === featureId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

function tasksForTarget(
  snapshot: ProjectPlanSnapshot,
  targetType: "aspect" | "feature",
  targetId: string
): Task[] {
  const taskIds = new Set<string>();
  for (const task of snapshot.tasks) {
    const primary = getPrimaryTaskLink(task, snapshot);
    if (primary && primary.targetType === targetType && primary.targetId === targetId) {
      taskIds.add(task.id);
    }
  }
  return snapshot.tasks
    .filter((task) => taskIds.has(task.id))
    .sort((a, b) => a.key.localeCompare(b.key) || a.sortOrder - b.sortOrder);
}

export function listChildCards(snapshot: ProjectPlanSnapshot, scopeId: string): KanbanCard[] {
  const aspect = snapshot.nodes.find((node) => node.id === scopeId && node.type === "aspect");
  if (aspect) {
    const childAspects = snapshot.nodes
      .filter((node) => node.type === "aspect" && node.parentId === scopeId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      .map(aspectCard);
    const features = featuresForAspect(snapshot, scopeId).map(featureCard);
    const tasks = tasksForTarget(snapshot, "aspect", scopeId).map(taskCard);
    return [...childAspects, ...features, ...tasks];
  }

  const feature = snapshot.features.find((item) => item.id === scopeId);
  if (feature) {
    const nested = featuresForFeature(snapshot, scopeId).map(featureCard);
    const tasks = tasksForTarget(snapshot, "feature", scopeId).map(taskCard);
    return [...nested, ...tasks];
  }

  return [];
}

export function listBoardCards(snapshot: ProjectPlanSnapshot, scopeId: string | null): KanbanCard[] {
  return scopeId ? listChildCards(snapshot, scopeId) : listRootAspectCards(snapshot);
}

export function childColumnsForCard(snapshot: ProjectPlanSnapshot, card: KanbanCard): KanbanColumnId[] {
  if (!card.canEnter) {
    return [];
  }
  return listChildCards(snapshot, card.id).map((child) => child.column);
}

export type KanbanScopeCrumb = {
  id: string;
  kind: "aspect" | "feature";
  title: string;
};

export function buildKanbanBreadcrumbs(snapshot: ProjectPlanSnapshot, scopeId: string | null): KanbanScopeCrumb[] {
  if (!scopeId) {
    return [];
  }

  const aspect = snapshot.nodes.find((node) => node.id === scopeId && node.type === "aspect");
  if (aspect) {
    const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const crumbs: KanbanScopeCrumb[] = [];
    let cursor: ProjectNode | undefined = aspect;
    while (cursor && cursor.type === "aspect") {
      crumbs.unshift({ id: cursor.id, kind: "aspect", title: cursor.title });
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return crumbs;
  }

  const feature = snapshot.features.find((item) => item.id === scopeId);
  if (!feature) {
    return [];
  }

  const featureCrumbs: KanbanScopeCrumb[] = [];
  let featureCursor: Feature | undefined = feature;
  while (featureCursor) {
    featureCrumbs.unshift({ id: featureCursor.id, kind: "feature", title: featureCursor.title });
    featureCursor = featureCursor.parentFeatureId
      ? snapshot.features.find((item) => item.id === featureCursor!.parentFeatureId)
      : undefined;
  }

  const primaryAspectId =
    snapshot.featureAspectLinks.find((link) => link.featureId === feature.id && link.isPrimary)?.aspectId ??
    snapshot.featureAspectLinks.find((link) => link.featureId === feature.id)?.aspectId ??
    null;

  if (primaryAspectId) {
    return [...buildKanbanBreadcrumbs(snapshot, primaryAspectId), ...featureCrumbs];
  }

  return featureCrumbs;
}

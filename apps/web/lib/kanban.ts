import {
  deriveParentProcessStatus,
  getPrimaryTaskLink,
  type Feature,
  type ProcessStatus,
  type ProjectNode,
  type ProjectPlanSnapshot,
  type Task
} from "@projectplaner/core";

/** Process columns — mirrors Aspect/Feature/Task status ladder. */
export const kanbanColumns = [
  "in_planning",
  "planned",
  "in_progress",
  "done",
  "canceled",
  "archived"
] as const;
export type KanbanColumnId = (typeof kanbanColumns)[number];

export const kanbanColumnLabel: Record<KanbanColumnId, string> = {
  in_planning: "In planning",
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
  canceled: "Canceled",
  archived: "Archived"
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

const COLUMN_SET = new Set<string>(kanbanColumns);

export function statusToColumn(status: string): KanbanColumnId {
  if (COLUMN_SET.has(status)) {
    return status as KanbanColumnId;
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
    case "accepted":
    case "answered":
      return "done";
    case "not_implemented":
      return "in_planning";
    case "cancelled":
      return "canceled";
    default:
      return "planned";
  }
}

/** Best matching stored status when dropping onto a column. */
export function columnToStatus(column: KanbanColumnId, _kind: KanbanCardKind): ProcessStatus {
  return column;
}

export function deriveParentColumn(childColumns: KanbanColumnId[]): KanbanColumnId | null {
  return deriveParentProcessStatus(childColumns);
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

/** Lightweight scope row for the left sidebar (aspect, feature, or project root). */
export type SidebarScopeEntry = {
  id: string;
  title: string;
  path?: string;
};

/**
 * Current board focus + ancestor shortcuts for the left Scope section.
 * `recent` never includes `center` (avoids duplicate titles).
 */
export function buildKanbanSidebarScopes(
  snapshot: ProjectPlanSnapshot,
  scopeId: string | null
): {
  center: SidebarScopeEntry;
  recent: SidebarScopeEntry[];
  /** Best ProjectNode for creation rail / inspector when scoped. */
  focusNode: ProjectNode | null;
} {
  const root = snapshot.nodes[0] ?? null;
  const crumbs = buildKanbanBreadcrumbs(snapshot, scopeId);
  const scopeAspect = scopeId
    ? snapshot.nodes.find((node) => node.id === scopeId) ?? null
    : null;
  const scopeFeature = scopeId ? snapshot.features.find((feature) => feature.id === scopeId) ?? null : null;

  const center: SidebarScopeEntry = scopeId
    ? {
        id: scopeId,
        title: crumbs[crumbs.length - 1]?.title ?? scopeAspect?.title ?? scopeFeature?.title ?? scopeId,
        path: scopeAspect?.path
      }
    : {
        id: root?.id ?? "root",
        title: root?.title ?? "Top-level Aspects",
        path: root?.path
      };

  const recent: SidebarScopeEntry[] = [];
  if (root && root.id !== center.id) {
    recent.push({ id: root.id, title: root.title, path: root.path });
  }
  for (const crumb of crumbs) {
    if (crumb.id === center.id) {
      continue;
    }
    if (recent.some((entry) => entry.id === crumb.id)) {
      continue;
    }
    recent.push({ id: crumb.id, title: crumb.title });
  }

  let focusNode: ProjectNode | null = scopeAspect;
  if (!focusNode && scopeFeature) {
    const primaryAspectId =
      snapshot.featureAspectLinks.find((link) => link.featureId === scopeFeature.id && link.isPrimary)?.aspectId ??
      snapshot.featureAspectLinks.find((link) => link.featureId === scopeFeature.id)?.aspectId ??
      null;
    focusNode = primaryAspectId
      ? snapshot.nodes.find((node) => node.id === primaryAspectId) ?? root
      : root;
  }
  if (!focusNode) {
    focusNode = root;
  }

  return { center, recent, focusNode };
}

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

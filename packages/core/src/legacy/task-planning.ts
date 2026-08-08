import type {
  EntityRef,
  Feature,
  LegacyEntityRelation,
  ProjectNode,
  ProjectPlanSnapshot,
  Tag,
  Task,
  TaskLink
} from "../domain/types";

export interface AspectTaskQueryOptions {
  includeSubaspects?: boolean;
  includeFeatures?: boolean;
}

export interface FeatureTaskQueryOptions {
  includeNestedFeatures?: boolean;
}

export function validateTaskLinks(taskId: string, links: TaskLink[]): string[] {
  return links.some((link) => link.taskId === taskId) ? [] : ["Task must link to at least one Aspect or Feature."];
}

export function getDescendantAspectIds(aspectId: string, nodes: ProjectNode[]): Set<string> {
  const root = nodes.find((node) => node.id === aspectId);
  const ids = new Set<string>([aspectId]);

  if (!root) {
    return ids;
  }

  for (const node of nodes) {
    if (node.type === "aspect" && node.path.startsWith(`${root.path}.`)) {
      ids.add(node.id);
    }
  }

  return ids;
}

export function getNestedFeatureIds(featureId: string, features: Feature[]): Set<string> {
  const ids = new Set<string>([featureId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const feature of features) {
      if (feature.parentFeatureId && ids.has(feature.parentFeatureId) && !ids.has(feature.id)) {
        ids.add(feature.id);
        changed = true;
      }
    }
  }

  return ids;
}

export function getTaskLinks(taskId: string, snapshot: ProjectPlanSnapshot): TaskLink[] {
  return snapshot.taskLinks.filter((link) => link.taskId === taskId);
}

export function getTasksForAspect(
  aspectId: string,
  snapshot: ProjectPlanSnapshot,
  options: AspectTaskQueryOptions = {}
): Task[] {
  const aspectIds = options.includeSubaspects ? getDescendantAspectIds(aspectId, snapshot.nodes) : new Set([aspectId]);
  const featureIds = new Set<string>();

  if (options.includeFeatures) {
    for (const link of snapshot.featureAspectLinks) {
      if (aspectIds.has(link.aspectId)) {
        featureIds.add(link.featureId);
      }
    }
  }

  const taskIds = new Set(
    snapshot.taskLinks
      .filter(
        (link) =>
          (link.targetType === "aspect" && aspectIds.has(link.targetId)) ||
          (link.targetType === "feature" && featureIds.has(link.targetId))
      )
      .map((link) => link.taskId)
  );

  return snapshot.tasks.filter((task) => taskIds.has(task.id));
}

export function getTasksForFeature(
  featureId: string,
  snapshot: ProjectPlanSnapshot,
  options: FeatureTaskQueryOptions = {}
): Task[] {
  const featureIds = options.includeNestedFeatures ? getNestedFeatureIds(featureId, snapshot.features) : new Set([featureId]);
  const taskIds = new Set(
    snapshot.taskLinks
      .filter((link) => link.targetType === "feature" && featureIds.has(link.targetId))
      .map((link) => link.taskId)
  );

  return snapshot.tasks.filter((task) => taskIds.has(task.id));
}

export function getEntityRelations(entity: EntityRef, snapshot: ProjectPlanSnapshot): LegacyEntityRelation[] {
  return snapshot.entityRelations.filter(
    (relation) => relation.sourceType === entity.type && relation.sourceId === entity.id
  );
}

export function getEntityDependents(entity: EntityRef, snapshot: ProjectPlanSnapshot): LegacyEntityRelation[] {
  return snapshot.entityRelations.filter(
    (relation) =>
      relation.type === "depends_on" && relation.targetType === entity.type && relation.targetId === entity.id
  );
}

export function getOpenWorkBelowAspect(aspectId: string, snapshot: ProjectPlanSnapshot): Task[] {
  return getTasksForAspect(aspectId, snapshot, { includeSubaspects: true, includeFeatures: true }).filter(
    (task) => task.status !== "done"
  );
}

export function getTagsForEntity(entity: EntityRef, snapshot: ProjectPlanSnapshot): Tag[] {
  const tagIds = new Set(
    snapshot.tagAssignments
      .filter((assignment) => assignment.targetType === entity.type && assignment.targetId === entity.id)
      .map((assignment) => assignment.tagId)
  );

  return snapshot.tags.filter((tag) => tagIds.has(tag.id));
}

export function getPrimaryTaskLink(task: Task, snapshot: ProjectPlanSnapshot): TaskLink | null {
  return (
    snapshot.taskLinks.find((link) => link.taskId === task.id && link.isPrimary) ??
    snapshot.taskLinks.find((link) => link.taskId === task.id) ??
    null
  );
}

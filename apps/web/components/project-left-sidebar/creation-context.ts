import type { EntityRelationType, ProjectNode, ProjectPlanSnapshot, TaskLinkType } from "@projectplaner/core";

export type CreationKind = "aspect" | "feature" | "task" | "entry" | "reference" | "relation";

export type CreationContext = {
  id: string;
  title: string;
  type: string;
  /** Preferred aspect/feature anchor for tasks and features. */
  planningTarget?: { targetType: "aspect" | "feature"; targetId: string; title: string };
  /** Preferred contains parent for nested nodes. */
  containsParentId?: string;
};

export function resolveCreationContext(
  snapshot: ProjectPlanSnapshot,
  selectedId: string | undefined,
  centerNode: ProjectNode | undefined
): CreationContext | null {
  const id = selectedId ?? centerNode?.id;
  if (!id) {
    return null;
  }

  const node = snapshot.nodes.find((item) => item.id === id);
  if (node) {
    const planningTarget =
      node.type === "aspect"
        ? { targetType: "aspect" as const, targetId: node.id, title: node.title }
        : node.type === "feature"
          ? { targetType: "feature" as const, targetId: node.id, title: node.title }
          : undefined;
    return {
      id: node.id,
      title: node.title,
      type: node.type,
      planningTarget,
      containsParentId: node.type === "project" || node.type === "aspect" ? node.id : (node.parentId ?? snapshot.nodes[0]?.id)
    };
  }

  const feature = snapshot.features.find((item) => item.id === id);
  if (feature) {
    const aspectLink = snapshot.featureAspectLinks.find((link) => link.featureId === feature.id);
    const aspect = aspectLink ? snapshot.nodes.find((item) => item.id === aspectLink.aspectId) : undefined;
    return {
      id: feature.id,
      title: feature.title,
      type: "feature",
      planningTarget: { targetType: "feature", targetId: feature.id, title: feature.title },
      containsParentId: aspect?.id ?? centerNode?.id ?? snapshot.nodes[0]?.id
    };
  }

  const task = snapshot.tasks.find((item) => item.id === id);
  if (task) {
    const link = snapshot.taskLinks.find((item) => item.taskId === task.id);
    const target =
      link?.targetType === "feature"
        ? snapshot.features.find((item) => item.id === link.targetId)
        : snapshot.nodes.find((item) => item.id === link?.targetId);
    return {
      id: task.id,
      title: task.title,
      type: "task",
      planningTarget: link
        ? {
            targetType: link.targetType,
            targetId: link.targetId,
            title: target?.title ?? link.targetId
          }
        : undefined,
      containsParentId:
        link?.targetType === "aspect" ? link.targetId : (centerNode?.id ?? snapshot.nodes[0]?.id)
    };
  }

  return {
    id,
    title: id,
    type: "unknown",
    containsParentId: centerNode?.id ?? snapshot.nodes[0]?.id
  };
}

export function defaultAspectParentId(context: CreationContext | null, snapshot: ProjectPlanSnapshot): string {
  return context?.containsParentId ?? snapshot.nodes[0]?.id ?? "";
}

export function defaultFeatureAspectId(context: CreationContext | null, snapshot: ProjectPlanSnapshot): string | null {
  if (!context) {
    const rootAspect = snapshot.nodes.find((node) => node.type === "aspect" && node.parentId === snapshot.nodes[0]?.id);
    return rootAspect?.id ?? null;
  }
  if (context.planningTarget?.targetType === "aspect") {
    return context.planningTarget.targetId;
  }
  if (context.type === "feature") {
    const link = snapshot.featureAspectLinks.find((item) => item.featureId === context.id);
    return link?.aspectId ?? null;
  }
  if (context.containsParentId) {
    const parent = snapshot.nodes.find((node) => node.id === context.containsParentId);
    if (parent?.type === "aspect") {
      return parent.id;
    }
  }
  return null;
}

export function defaultTaskTarget(
  context: CreationContext | null,
  snapshot: ProjectPlanSnapshot
): { targetType: "aspect" | "feature"; targetId: string } | null {
  if (context?.planningTarget) {
    return { targetType: context.planningTarget.targetType, targetId: context.planningTarget.targetId };
  }
  const aspectId = defaultFeatureAspectId(context, snapshot);
  return aspectId ? { targetType: "aspect", targetId: aspectId } : null;
}

export const RELATION_TYPE_OPTIONS: EntityRelationType[] = [
  "contains",
  "related_to",
  "depends_on",
  "blocks",
  "implements",
  "affects",
  "references",
  "supports",
  "leads_to"
];

export const TASK_LINK_OPTIONS: TaskLinkType[] = ["affects", "implements", "validates", "investigates"];

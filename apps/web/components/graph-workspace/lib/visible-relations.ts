import type { LegacyEntityRelation, ProjectPlanSnapshot } from "@projectplaner/core";

export function getVisibleEntityRelations(snapshot: ProjectPlanSnapshot): LegacyEntityRelation[] {
  return [
    ...snapshot.entityRelations,
    ...snapshot.taskLinks.map((link) => ({
      id: link.id,
      projectId: snapshot.project.id,
      sourceType: "task" as const,
      sourceId: link.taskId,
      targetType: link.targetType,
      targetId: link.targetId,
      type: link.type,
      label: null,
      metadata: {}
    })),
    ...snapshot.featureAspectLinks.map((link) => ({
      id: link.id,
      projectId: snapshot.project.id,
      sourceType: "feature" as const,
      sourceId: link.featureId,
      targetType: "aspect" as const,
      targetId: link.aspectId,
      type: link.type,
      label: null,
      metadata: {}
    }))
  ];
}

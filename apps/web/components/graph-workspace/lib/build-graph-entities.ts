import type { ProjectPlanSnapshot } from "@projectplaner/core";
import type { GraphEntity } from "../types";

export function buildGraphEntities(snapshot: ProjectPlanSnapshot): GraphEntity[] {
  return [
    ...snapshot.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      key: null,
      title: node.title,
      summary: node.summary,
      body: node.body,
      status: node.status,
      metadata: node.metadata,
      sortOrder: node.sortOrder,
      path: node.path
    })),
    ...snapshot.features.map((feature) => ({
      id: feature.id,
      type: "feature" as const,
      key: feature.key,
      title: feature.title,
      summary: feature.summary,
      body: feature.body,
      status: feature.status,
      metadata: { ...feature.metadata, acceptanceShape: feature.acceptanceShape },
      sortOrder: feature.sortOrder
    })),
    ...snapshot.tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      key: task.key,
      title: task.title,
      summary: task.description,
      body: task.description,
      status: task.status,
      metadata: { ...task.metadata, priority: task.priority, acceptanceCriteria: task.acceptanceCriteria },
      sortOrder: task.sortOrder
    }))
  ];
}

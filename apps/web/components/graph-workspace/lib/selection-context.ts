import {
  getTagsForEntity,
  getTasksForAspect,
  type Feature,
  type ProjectNode,
  type ProjectPlanSnapshot,
  type Tag,
  type Task
} from "@projectplaner/core";
import type { GraphEntity } from "../types";

export function resolveInitialSelection(options: {
  snapshot: ProjectPlanSnapshot;
  allGraphEntities: GraphEntity[];
  initialSelectedId?: string;
}): {
  rootNode: ProjectNode;
  initialSelectedEntity: GraphEntity | ProjectNode;
  initialCenterNode: ProjectNode;
} {
  const { snapshot, allGraphEntities, initialSelectedId } = options;
  const rootNode = snapshot.nodes[0];
  const initialSelectedEntity = allGraphEntities.find((entity) => entity.id === initialSelectedId) ?? rootNode;
  const initialCenterNode =
    initialSelectedEntity.type === "aspect"
      ? (snapshot.nodes.find((node) => node.id === initialSelectedEntity.id) ?? rootNode)
      : rootNode;
  return { rootNode, initialSelectedEntity, initialCenterNode };
}

export function resolveSelection(options: {
  snapshot: ProjectPlanSnapshot;
  allGraphEntities: GraphEntity[];
  centerNode: ProjectNode;
  selectedId: string | undefined;
  selectedFeatureId: string | null;
}): {
  selectedEntity: GraphEntity;
  selectedNode: ProjectNode;
  selectedFeature: Feature | null;
} {
  const { snapshot, allGraphEntities, centerNode, selectedId, selectedFeatureId } = options;
  const selectedEntity = allGraphEntities.find((entity) => entity.id === (selectedFeatureId ?? selectedId)) ?? allGraphEntities[0];
  const selectedNode = snapshot.nodes.find((node) => node.id === selectedId) ?? centerNode;
  const selectedFeature = selectedFeatureId
    ? snapshot.features.find((feature) => feature.id === selectedFeatureId) ?? null
    : selectedEntity.type === "feature"
      ? snapshot.features.find((feature) => feature.id === selectedEntity.id) ?? null
      : null;
  return { selectedEntity, selectedNode, selectedFeature };
}

export function buildInspectorSelectionData(options: {
  snapshot: ProjectPlanSnapshot;
  selectedNode: ProjectNode;
  selectedEntity: GraphEntity;
}): {
  incomingCount: number;
  outgoingCount: number;
  directTasks: Task[];
  featureTasks: Task[];
  subaspectTasks: Task[];
  relatedFeatures: Feature[];
  tags: Tag[];
} {
  const { snapshot, selectedNode, selectedEntity } = options;
  const incoming = snapshot.relations.filter((relation) => relation.targetNodeId === selectedNode.id);
  const outgoing = snapshot.relations.filter((relation) => relation.sourceNodeId === selectedNode.id);
  const directAspectTasks = getTasksForAspect(selectedNode.id, snapshot);
  const aspectAndFeatureTasks = getTasksForAspect(selectedNode.id, snapshot, { includeFeatures: true });
  const allAspectTasks = getTasksForAspect(selectedNode.id, snapshot, {
    includeSubaspects: true,
    includeFeatures: true
  });
  const directTaskIds = new Set(directAspectTasks.map((task) => task.id));
  const aspectFeatureTaskIds = new Set(aspectAndFeatureTasks.map((task) => task.id));
  const featureTasks = aspectAndFeatureTasks.filter((task) => !directTaskIds.has(task.id));
  const subaspectTasks = allAspectTasks.filter((task) => !aspectFeatureTaskIds.has(task.id));
  const relatedFeatures = snapshot.featureAspectLinks
    .filter((link) => link.aspectId === selectedNode.id)
    .map((link) => snapshot.features.find((feature) => feature.id === link.featureId))
    .filter((feature): feature is Feature => Boolean(feature));
  const tags = getTagsForEntity({ type: selectedEntity.type, id: selectedEntity.id }, snapshot);

  return {
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    directTasks: directAspectTasks,
    featureTasks,
    subaspectTasks,
    relatedFeatures,
    tags
  };
}

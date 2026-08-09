import type { Edge, Node } from "@xyflow/react";
import type { EntityType, LegacyEntityRelation, ProjectNode, ProjectRelation } from "@projectplaner/core";
import type { GraphEntity, GraphFlowNodeData, GraphMatch } from "../types";
import { graphEdgeStroke } from "./edge-style";

export function buildScopedFlowNodes(options: {
  nodes: ProjectNode[];
  centerNode: ProjectNode;
  allGraphEntities: GraphEntity[];
  selectedId: string | undefined;
}): Node<GraphFlowNodeData>[] {
  const { nodes, centerNode, allGraphEntities, selectedId } = options;
  const childIds = new Set(nodes.filter((node) => node.parentId === centerNode.id).map((node) => node.id));

  return nodes.map((node, index) => {
    const layout = node.metadata.layout as { x?: number; y?: number } | undefined;
    const isCenter = node.id === centerNode.id;
    const entity = allGraphEntities.find((item) => item.id === node.id);
    const childIndex = Array.from(childIds).indexOf(node.id);
    const childCount = Math.max(childIds.size, 1);
    const childY = (childIndex - (childCount - 1) / 2) * 170;
    const relatedIndex = Math.max(0, index - childIds.size);

    return {
      id: node.id,
      type: "projectNode",
      position: {
        x: layout?.x ?? (isCenter ? 0 : childIds.has(node.id) ? 430 : -390),
        y: layout?.y ?? (isCenter ? 0 : childIds.has(node.id) ? childY : (relatedIndex - 1) * 160)
      },
      data: {
        entity: entity ?? {
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
        },
        isCenter,
        isSelected: selectedId === node.id
      }
    };
  });
}

export function buildFullFlowNodes(options: {
  scoredEntities: GraphMatch[];
  entityTypes: EntityType[];
  centerId: string;
  selectedId: string | undefined;
  selectedFeatureId: string | null;
  query: string;
}): Node<GraphFlowNodeData>[] {
  const { scoredEntities, entityTypes, centerId, selectedId, selectedFeatureId, query } = options;
  const lanes = new Map<EntityType, number>();
  return scoredEntities.map(({ entity, score }) => {
    const laneIndex = entityTypes.indexOf(entity.type);
    const rowIndex = lanes.get(entity.type) ?? 0;
    lanes.set(entity.type, rowIndex + 1);
    return {
      id: entity.id,
      type: "projectNode",
      position: {
        x: laneIndex * 150,
        y: rowIndex * 82
      },
      data: {
        entity,
        isCenter: entity.id === centerId,
        isSelected: entity.id === (selectedFeatureId ?? selectedId),
        score: query.trim() ? score : undefined
      }
    };
  });
}

export function buildScopedFlowEdges(options: {
  nodes: ProjectNode[];
  relations: ProjectRelation[];
  centerNode: ProjectNode;
  focusId: string | undefined;
}): Edge[] {
  const { nodes, relations, centerNode, focusId } = options;
  const relationIds = new Set(relations.map((relation) => `${relation.sourceNodeId}:${relation.targetNodeId}`));

  const relationEdges: Edge[] = relations.map((relation) => {
    const selected = relation.sourceNodeId === focusId || relation.targetNodeId === focusId;
    const conflict = relation.type === "conflicts_with";
    return {
      id: relation.id,
      source: relation.sourceNodeId,
      target: relation.targetNodeId,
      label: relation.label ?? relation.type,
      type: "smoothstep",
      animated: selected || relation.type === "blocks" || relation.type === "conflicts_with",
      zIndex: selected ? 8 : 0,
      style: graphEdgeStroke({ selected, conflict })
    };
  });

  const hierarchyEdges: Edge[] = nodes
    .filter((node) => node.parentId === centerNode.id && !relationIds.has(`${centerNode.id}:${node.id}`))
    .map((node) => {
      const selected = centerNode.id === focusId || node.id === focusId;
      return {
        id: `tree-${centerNode.id}-${node.id}`,
        source: centerNode.id,
        target: node.id,
        label: "plans",
        type: "smoothstep",
        zIndex: selected ? 8 : 0,
        style: {
          ...graphEdgeStroke({ selected }),
          strokeDasharray: "4 4"
        }
      };
    });

  return [...hierarchyEdges, ...relationEdges];
}

export function buildFullFlowEdges(options: {
  relations: LegacyEntityRelation[];
  displayedIds: Set<string>;
  focusId: string | undefined;
}): Edge[] {
  const { relations, displayedIds, focusId } = options;
  return relations
    .filter((relation) => displayedIds.has(relation.sourceId) && displayedIds.has(relation.targetId))
    .map((relation) => {
      const selected = relation.sourceId === focusId || relation.targetId === focusId;
      const conflict = relation.type === "conflicts_with" || relation.type === "blocked_by";
      return {
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        label: relation.label ?? relation.type,
        type: "smoothstep",
        animated:
          selected ||
          relation.type === "blocks" ||
          relation.type === "conflicts_with" ||
          relation.type === "blocked_by",
        zIndex: selected ? 8 : 0,
        style: graphEdgeStroke({ selected, conflict })
      };
    });
}

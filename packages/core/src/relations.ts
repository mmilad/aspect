import { relationTypes, type ProjectNode, type ProjectRelation, type RelationType } from "./types";

export function isRelationType(value: string): value is RelationType {
  return relationTypes.includes(value as RelationType);
}

export function validateRelation(
  relation: Pick<ProjectRelation, "sourceNodeId" | "targetNodeId" | "type">,
  nodes: Pick<ProjectNode, "id">[]
): string[] {
  const errors: string[] = [];
  const ids = new Set(nodes.map((node) => node.id));

  if (!ids.has(relation.sourceNodeId)) {
    errors.push("Source node does not exist.");
  }

  if (!ids.has(relation.targetNodeId)) {
    errors.push("Target node does not exist.");
  }

  if (relation.sourceNodeId === relation.targetNodeId) {
    errors.push("A relation cannot target the same node.");
  }

  if (!isRelationType(relation.type)) {
    errors.push("Relation type is not supported.");
  }

  return errors;
}

export function scopedGraph(
  rootNodeId: string,
  nodes: ProjectNode[],
  relations: ProjectRelation[]
): { nodes: ProjectNode[]; relations: ProjectRelation[] } {
  const root = nodes.find((node) => node.id === rootNodeId);
  if (!root) {
    return { nodes: [], relations: [] };
  }

  const scopedNodes = nodes.filter((node) => node.id === root.id || node.path.startsWith(`${root.path}.`));
  const scopedIds = new Set(scopedNodes.map((node) => node.id));
  const scopedRelations = relations.filter(
    (relation) => scopedIds.has(relation.sourceNodeId) && scopedIds.has(relation.targetNodeId)
  );

  return { nodes: scopedNodes, relations: scopedRelations };
}

export function focusGraph(
  centerNodeId: string,
  nodes: ProjectNode[],
  relations: ProjectRelation[]
): { center: ProjectNode | null; nodes: ProjectNode[]; relations: ProjectRelation[] } {
  const center = nodes.find((node) => node.id === centerNodeId) ?? null;
  if (!center) {
    return { center: null, nodes: [], relations: [] };
  }

  const visibleIds = new Set<string>([center.id]);

  for (const node of nodes) {
    if (node.parentId === center.id) {
      visibleIds.add(node.id);
    }
  }

  for (const relation of relations) {
    if (relation.sourceNodeId === center.id || relation.targetNodeId === center.id) {
      visibleIds.add(relation.sourceNodeId);
      visibleIds.add(relation.targetNodeId);
    }
  }

  const visibleNodes = nodes.filter((node) => visibleIds.has(node.id));
  const visibleRelations = relations.filter(
    (relation) => visibleIds.has(relation.sourceNodeId) && visibleIds.has(relation.targetNodeId)
  );

  return { center, nodes: visibleNodes, relations: visibleRelations };
}

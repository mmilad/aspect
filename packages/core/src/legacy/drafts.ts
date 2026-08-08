import type { DraftChange, ProjectNode, ProjectRelation } from "../domain/types";

export interface DraftConflict {
  severity: "warning" | "error";
  message: string;
  targetId?: string | null;
}

export function detectDraftConflicts(input: {
  changes: DraftChange[];
  nodes: ProjectNode[];
  relations: ProjectRelation[];
}): DraftConflict[] {
  const conflicts: DraftConflict[] = [];
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const relationsById = new Map(input.relations.map((relation) => [relation.id, relation]));

  for (const change of input.changes) {
    if (change.changeType !== "create" && change.targetType === "node" && !nodesById.has(String(change.targetId))) {
      conflicts.push({
        severity: "error",
        message: "Draft changes a node that does not exist.",
        targetId: change.targetId
      });
    }

    if (
      change.changeType !== "create" &&
      change.targetType === "relation" &&
      !relationsById.has(String(change.targetId))
    ) {
      conflicts.push({
        severity: "error",
        message: "Draft changes a relation that does not exist.",
        targetId: change.targetId
      });
    }

    if (change.changeType === "delete" && change.targetType === "node") {
      const blockingRelations = input.relations.filter(
        (relation) =>
          relation.targetNodeId === change.targetId &&
          (relation.type === "depends_on" || relation.type === "blocks")
      );
      if (blockingRelations.length > 0) {
        conflicts.push({
          severity: "error",
          message: "Draft removes a node that other nodes depend on.",
          targetId: change.targetId
        });
      }
    }

    if (change.changeType === "create" && change.targetType === "node") {
      const parentId = typeof change.payload.parentId === "string" ? change.payload.parentId : null;
      const title = typeof change.payload.title === "string" ? change.payload.title.trim().toLowerCase() : "";
      const duplicate = input.nodes.some(
        (node) => node.parentId === parentId && node.title.trim().toLowerCase() === title
      );
      if (title && duplicate) {
        conflicts.push({
          severity: "warning",
          message: "Draft creates a duplicate node title in the same parent.",
          targetId: change.targetId
        });
      }
    }
  }

  for (const relation of input.relations) {
    if (relation.type === "conflicts_with") {
      const changedIds = new Set(input.changes.map((change) => change.targetId));
      if (changedIds.has(relation.sourceNodeId) || changedIds.has(relation.targetNodeId)) {
        conflicts.push({
          severity: "warning",
          message: "Draft touches a node that has an explicit conflict relation.",
          targetId: relation.sourceNodeId
        });
      }
    }
  }

  return conflicts;
}


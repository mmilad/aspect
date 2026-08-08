import type { ProjectNode } from "@projectplaner/core";

export function getAncestors(node: ProjectNode, nodes: ProjectNode[]): ProjectNode[] {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const ancestors: ProjectNode[] = [];
  let cursor: ProjectNode | undefined = node;

  while (cursor) {
    ancestors.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return ancestors;
}

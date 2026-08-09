import { getPrimaryTaskLink, type LegacyEntityRelation, type ProjectPlanSnapshot } from "@projectplaner/core";
import type { GraphMatch, GraphMode } from "../types";

export const graphModes = ["full", "tree", "neighborhood", "open_work", "workflow", "deps"] as const;

export const graphModeLabel: Record<GraphMode, string> = {
  full: "Full",
  tree: "Tree",
  neighborhood: "Near",
  open_work: "Open",
  workflow: "Flows",
  deps: "Deps"
};

const DEPENDENCY_TYPES = new Set(["depends_on", "blocks", "blocked_by"]);

/** Filter scored entities for non-tree modes (tree uses scoped builders). */
export function filterMatchesForGraphMode(options: {
  mode: GraphMode;
  matches: GraphMatch[];
  snapshot: ProjectPlanSnapshot;
  relations: LegacyEntityRelation[];
  focusId: string | undefined;
}): GraphMatch[] {
  const { mode, matches, snapshot, relations, focusId } = options;

  if (mode === "full" || mode === "tree") {
    return matches;
  }

  if (mode === "neighborhood") {
    if (!focusId) {
      return matches;
    }
    const neighborIds = new Set<string>([focusId]);
    for (const relation of relations) {
      if (relation.sourceId === focusId) {
        neighborIds.add(relation.targetId);
      }
      if (relation.targetId === focusId) {
        neighborIds.add(relation.sourceId);
      }
    }
    return matches.filter((match) => neighborIds.has(match.entity.id));
  }

  if (mode === "open_work") {
    const keep = new Set<string>();
    for (const task of snapshot.tasks) {
      if (task.status === "done") {
        continue;
      }
      keep.add(task.id);
      const primary = getPrimaryTaskLink(task, snapshot);
      if (primary) {
        keep.add(primary.targetId);
      }
    }
    return matches.filter((match) => keep.has(match.entity.id));
  }

  if (mode === "workflow") {
    const flowIds = new Set(matches.filter((match) => match.entity.type === "flow").map((match) => match.entity.id));
    const keep = new Set(flowIds);
    for (const relation of relations) {
      if (flowIds.has(relation.sourceId)) {
        keep.add(relation.targetId);
      }
      if (flowIds.has(relation.targetId)) {
        keep.add(relation.sourceId);
      }
    }
    return matches.filter((match) => keep.has(match.entity.id));
  }

  // deps
  const keep = new Set<string>();
  for (const relation of relations) {
    if (!DEPENDENCY_TYPES.has(relation.type)) {
      continue;
    }
    keep.add(relation.sourceId);
    keep.add(relation.targetId);
  }
  return matches.filter((match) => keep.has(match.entity.id));
}

export function filterRelationsForGraphMode(
  mode: GraphMode,
  relations: LegacyEntityRelation[],
  displayedIds: Set<string>
): LegacyEntityRelation[] {
  const inView = relations.filter(
    (relation) => displayedIds.has(relation.sourceId) && displayedIds.has(relation.targetId)
  );
  if (mode !== "deps") {
    return inView;
  }
  return inView.filter((relation) => DEPENDENCY_TYPES.has(relation.type));
}

export function isTreeGraphMode(mode: GraphMode): boolean {
  return mode === "tree";
}

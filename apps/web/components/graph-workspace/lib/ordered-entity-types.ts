import type { EntityType } from "@projectplaner/core";

/** Stable lane / filter order for entity types in the graph workspace. */
export const ENTITY_TYPE_ORDER: EntityType[] = [
  "project",
  "aspect",
  "feature",
  "task",
  "decision",
  "question",
  "reference",
  "flow",
  "entry",
  "area",
  "surface",
  "task_group"
];

export function compareEntityTypes(left: EntityType, right: EntityType): number {
  return ENTITY_TYPE_ORDER.indexOf(left) - ENTITY_TYPE_ORDER.indexOf(right);
}

export function orderedEntityTypes(types: Iterable<EntityType>): EntityType[] {
  return [...new Set(types)].sort(compareEntityTypes);
}

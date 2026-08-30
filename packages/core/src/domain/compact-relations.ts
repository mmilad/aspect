import type { EntityRelation, EntityRelationType } from "./types";

/** Edges that attach a task to an Aspect/Feature. */
export const TASK_ANCHOR_RELATION_TYPES: readonly EntityRelationType[] = [
  "implements",
  "affects",
  "validates",
  "investigates"
];

/** Edges that order tasks relative to each other. */
export const TASK_ORDER_RELATION_TYPES: readonly EntityRelationType[] = ["depends_on", "blocked_by"];

export const TASK_CHAIN_RELATION_TYPES: readonly EntityRelationType[] = [
  ...TASK_ORDER_RELATION_TYPES,
  ...TASK_ANCHOR_RELATION_TYPES
];

const TASK_CHAIN_RANK = new Map(TASK_CHAIN_RELATION_TYPES.map((type, index) => [type, index]));
const TASK_ORDER_TYPES = new Set<string>(TASK_ORDER_RELATION_TYPES);

export function isTaskChainRelationType(type: string): boolean {
  return TASK_CHAIN_RANK.has(type as EntityRelationType);
}

export function isTaskOrderRelationType(type: string): boolean {
  return TASK_ORDER_TYPES.has(type);
}

/** One hop along depends_on / blocked_by so order partners are visible without walking other features. */
export function expandTaskChainIds(seedIds: Iterable<string>, relations: EntityRelation[]): Set<string> {
  const ids = new Set(seedIds);
  const extra: string[] = [];
  for (const relation of relations) {
    if (!isTaskOrderRelationType(relation.type)) {
      continue;
    }
    if (ids.has(relation.sourceEntityId) && !ids.has(relation.targetEntityId)) {
      extra.push(relation.targetEntityId);
    } else if (ids.has(relation.targetEntityId) && !ids.has(relation.sourceEntityId)) {
      extra.push(relation.sourceEntityId);
    }
  }
  for (const id of extra) {
    ids.add(id);
  }
  return ids;
}

/**
 * Compact packets cap neighborhood edges at `limit`, which hid depends_on / implements.
 * Always keep task-chain edges among `chainIds`; fill remaining slots from the neighborhood.
 * Anchor types (implements/…) only count when they touch `anchorIds` (the Feature/Aspect seed).
 */
export function selectCompactContextRelations(
  relations: EntityRelation[],
  input: { chainIds: Set<string>; neighborhoodIds: Set<string>; limit: number; anchorIds?: Set<string> }
): EntityRelation[] {
  const limit = Math.max(1, input.limit);
  const anchors = input.anchorIds ?? input.neighborhoodIds;
  const inChain = (relation: EntityRelation) =>
    input.chainIds.has(relation.sourceEntityId) && input.chainIds.has(relation.targetEntityId);
  const inNeighborhood = (relation: EntityRelation) =>
    input.neighborhoodIds.has(relation.sourceEntityId) && input.neighborhoodIds.has(relation.targetEntityId);
  const touchesAnchor = (relation: EntityRelation) =>
    anchors.has(relation.sourceEntityId) || anchors.has(relation.targetEntityId);

  const chainRelations = relations
    .filter((relation) => {
      if (!inChain(relation)) {
        return false;
      }
      if (isTaskOrderRelationType(relation.type)) {
        return true;
      }
      return isTaskChainRelationType(relation.type) && touchesAnchor(relation);
    })
    .sort((left, right) => {
      const rankDelta =
        (TASK_CHAIN_RANK.get(left.type) ?? 99) - (TASK_CHAIN_RANK.get(right.type) ?? 99);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return left.id.localeCompare(right.id);
    });

  const selected: EntityRelation[] = [...chainRelations];
  const seen = new Set(chainRelations.map((relation) => relation.id));
  const cap = Math.max(limit, chainRelations.length);

  for (const relation of relations) {
    if (selected.length >= cap) {
      break;
    }
    if (seen.has(relation.id) || !inNeighborhood(relation)) {
      continue;
    }
    if (isTaskChainRelationType(relation.type) && !isTaskOrderRelationType(relation.type) && !touchesAnchor(relation)) {
      continue;
    }
    seen.add(relation.id);
    selected.push(relation);
  }

  return selected;
}

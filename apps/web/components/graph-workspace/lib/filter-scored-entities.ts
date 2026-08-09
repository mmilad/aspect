import type { EntityType } from "@projectplaner/core";
import type { GraphEntity, GraphMatch } from "../types";
import { scoreEntity } from "./score-entity";

/** Type filter + scored search used by the full-entity graph workspace. */
export function filterScoredEntities(
  entities: GraphEntity[],
  options: { activeTypes: Set<EntityType>; query: string }
): GraphMatch[] {
  const { activeTypes, query } = options;
  return entities
    .map((entity) => ({ entity, score: scoreEntity(entity, query) }))
    .filter(({ entity, score }) => activeTypes.has(entity.type) && (!query.trim() || score > 0))
    .sort((left, right) => right.score - left.score || left.entity.sortOrder - right.entity.sortOrder);
}

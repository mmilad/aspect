import {
  compactEntity,
  compactRelation
} from "../../../domain/task-candidacy";
import {
  expandTaskChainIds,
  selectCompactContextRelations
} from "../../../domain/compact-relations";
import type { Entity, EntityRelation } from "../../../domain/types";

const RELATION_LIMIT = 40;

export function walkNeighborhood(
  id: string,
  depth: number,
  entities: Entity[],
  relations: EntityRelation[],
  select: "compact" | "full" = "compact"
): { entities: unknown[]; relations: unknown[] } {
  const hops = Math.max(1, depth);
  const neighborhoodIds = new Set<string>([id]);
  let frontier = [id];
  for (let hop = 0; hop < hops; hop += 1) {
    const next: string[] = [];
    for (const relation of relations) {
      for (const from of frontier) {
        if (relation.sourceEntityId === from && !neighborhoodIds.has(relation.targetEntityId)) {
          neighborhoodIds.add(relation.targetEntityId);
          next.push(relation.targetEntityId);
        } else if (relation.targetEntityId === from && !neighborhoodIds.has(relation.sourceEntityId)) {
          neighborhoodIds.add(relation.sourceEntityId);
          next.push(relation.sourceEntityId);
        }
      }
    }
    frontier = next;
  }

  const chainIds = expandTaskChainIds(neighborhoodIds, relations);
  const keepIds = new Set([...neighborhoodIds, ...chainIds]);
  const selectedRelations = selectCompactContextRelations(relations, {
    chainIds,
    neighborhoodIds,
    limit: RELATION_LIMIT,
    anchorIds: new Set([id])
  });
  for (const relation of selectedRelations) {
    keepIds.add(relation.sourceEntityId);
    keepIds.add(relation.targetEntityId);
  }

  const selectedEntities = entities.filter((entity) => keepIds.has(entity.id));
  return {
    entities: select === "full" ? selectedEntities : selectedEntities.map(compactEntity),
    relations: select === "full" ? selectedRelations : selectedRelations.map(compactRelation)
  };
}

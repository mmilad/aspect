import type { Entity, EntityRef, EntityRelation } from "./types";

export interface EntityGraphValidationResult {
  errors: string[];
  warnings: string[];
}

const taskTargetTypes = new Set(["aspect", "feature"]);
const featureAspectRelationTypes = new Set(["implements", "affects", "supports"]);

export function getEntityById(entities: Entity[], id: string): Entity | null {
  return entities.find((entity) => entity.id === id) ?? null;
}

export function getGenericEntityDependents(entityId: string, relations: EntityRelation[]): EntityRelation[] {
  return relations.filter((relation) => relation.type === "depends_on" && relation.targetEntityId === entityId);
}

export function validateEntityGraph(entities: Entity[], relations: EntityRelation[]): EntityGraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  for (const relation of relations) {
    if (!byId.has(relation.sourceEntityId)) {
      errors.push(`Relation ${relation.id} source does not exist.`);
    }
    if (!byId.has(relation.targetEntityId)) {
      errors.push(`Relation ${relation.id} target does not exist.`);
    }
  }

  for (const task of entities.filter((entity) => entity.type === "task")) {
    const hasContext = relations.some((relation) => {
      if (relation.sourceEntityId !== task.id) {
        return false;
      }
      const target = byId.get(relation.targetEntityId);
      return Boolean(target && taskTargetTypes.has(target.type));
    });

    if (!hasContext) {
      errors.push(`Task ${task.id} must link to at least one Aspect or Feature.`);
    }
  }

  for (const feature of entities.filter((entity) => entity.type === "feature")) {
    const hasAspect = relations.some((relation) => {
      const target = byId.get(relation.targetEntityId);
      return (
        relation.sourceEntityId === feature.id &&
        Boolean(target && target.type === "aspect") &&
        featureAspectRelationTypes.has(relation.type)
      );
    });

    if (!hasAspect) {
      warnings.push(`Feature ${feature.id} should link to at least one Aspect.`);
    }
  }

  for (const aspect of entities.filter((entity) => entity.type === "aspect")) {
    const primaryParents = relations.filter(
      (relation) =>
        relation.type === "contains" &&
        relation.targetEntityId === aspect.id &&
        relation.isPrimary &&
        byId.get(relation.sourceEntityId)?.type !== "task"
    );

    if (primaryParents.length > 1) {
      errors.push(`Aspect ${aspect.id} has multiple primary parents.`);
    }
  }

  return { errors, warnings };
}

export function validateEntityRef(ref: EntityRef, entities: Entity[]): string[] {
  return entities.some((entity) => entity.id === ref.id && entity.type === ref.type)
    ? []
    : [`${ref.type} ${ref.id} does not exist.`];
}

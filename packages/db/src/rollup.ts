import type { Entity, EntityRelation, ProcessStatus } from "@projectplaner/core";
import domain from "@projectplaner/core/domain";

const { deriveParentProcessStatus, isProcessEntityType } = domain;
import type { DatabaseSync } from "node:sqlite";
import entities from "./repositories/entities";
import relations from "./repositories/relations";

function processChildrenStatuses(parent: Entity, entities: Entity[], relations: EntityRelation[]): string[] {
  const statuses: string[] = [];

  if (parent.type === "feature") {
    for (const entity of entities) {
      if (entity.type === "task") {
        const link = relations.find(
          (relation) =>
            relation.sourceEntityId === entity.id &&
            relation.targetEntityId === parent.id &&
            (relation.type === "affects" ||
              relation.type === "implements" ||
              relation.type === "validates" ||
              relation.type === "investigates")
        );
        if (link) {
          statuses.push(entity.status);
        }
      }
      if (entity.type === "feature" && entity.id !== parent.id) {
        // nested features via metadata/parent — legacy parentFeatureId is on Feature snapshot; in entities use contains
        const nested = relations.find(
          (relation) =>
            relation.type === "contains" &&
            relation.sourceEntityId === parent.id &&
            relation.targetEntityId === entity.id
        );
        if (nested) {
          statuses.push(entity.status);
        }
      }
    }
    return statuses;
  }

  if (parent.type === "aspect") {
    for (const entity of entities) {
      if (!isProcessEntityType(entity.type) || entity.id === parent.id) {
        continue;
      }
      if (entity.type === "aspect") {
        const contained = relations.find(
          (relation) =>
            relation.type === "contains" &&
            relation.isPrimary &&
            relation.sourceEntityId === parent.id &&
            relation.targetEntityId === entity.id
        );
        if (contained) {
          statuses.push(entity.status);
        }
        continue;
      }
      if (entity.type === "feature") {
        const linked = relations.find(
          (relation) =>
            relation.sourceEntityId === entity.id &&
            relation.targetEntityId === parent.id &&
            (relation.type === "implements" || relation.type === "affects" || relation.type === "supports")
        );
        if (linked) {
          statuses.push(entity.status);
        }
        continue;
      }
      if (entity.type === "task") {
        const linked = relations.find(
          (relation) =>
            relation.sourceEntityId === entity.id &&
            relation.targetEntityId === parent.id &&
            (relation.type === "affects" ||
              relation.type === "implements" ||
              relation.type === "validates" ||
              relation.type === "investigates")
        );
        if (linked) {
          statuses.push(entity.status);
        }
      }
    }
  }

  return statuses;
}

/** Direct process parent of an entity (feature/aspect), or null. */
export async function findProcessParent(
  db: DatabaseSync,
  entity: Entity
): Promise<Entity | null> {
  const graphRelations = await relations.list(db, {});

  if (entity.type === "task") {
    const link = graphRelations.find(
      (relation) =>
        relation.sourceEntityId === entity.id &&
        (relation.type === "affects" ||
          relation.type === "implements" ||
          relation.type === "validates" ||
          relation.type === "investigates") &&
        relation.isPrimary
    ) ??
      graphRelations.find(
        (relation) =>
          relation.sourceEntityId === entity.id &&
          (relation.type === "affects" ||
            relation.type === "implements" ||
            relation.type === "validates" ||
            relation.type === "investigates")
      );
    if (!link) {
      return null;
    }
    const parent = await entities.get(db, link.targetEntityId);
    return parent && isProcessEntityType(parent.type) ? parent : null;
  }

  if (entity.type === "feature") {
    const link = graphRelations.find(
      (relation) =>
        relation.sourceEntityId === entity.id &&
        (relation.type === "implements" || relation.type === "affects" || relation.type === "supports") &&
        relation.isPrimary
    ) ??
      graphRelations.find(
        (relation) =>
          relation.sourceEntityId === entity.id &&
          (relation.type === "implements" || relation.type === "affects" || relation.type === "supports")
      );
    if (link) {
      const parent = await entities.get(db, link.targetEntityId);
      if (parent && isProcessEntityType(parent.type)) {
        return parent;
      }
    }
    const contained = graphRelations.find(
      (relation) => relation.type === "contains" && relation.targetEntityId === entity.id && relation.isPrimary
    );
    if (contained) {
      const parent = await entities.get(db, contained.sourceEntityId);
      return parent && isProcessEntityType(parent.type) ? parent : null;
    }
    return null;
  }

  if (entity.type === "aspect") {
    const contained = graphRelations.find(
      (relation) =>
        relation.type === "contains" && relation.targetEntityId === entity.id && relation.isPrimary
    );
    if (!contained) {
      return null;
    }
    const parent = await entities.get(db, contained.sourceEntityId);
    return parent && parent.type === "aspect" ? parent : null;
  }

  return null;
}

export type RollupParentResult = {
  updatedIds: string[];
  derived: Array<{ id: string; from: string; to: ProcessStatus }>;
};

/**
 * Update direct parent status from first-level process children, then recurse upward.
 * Decisions/questions never participate.
 */
function projectKeyForEntity(db: DatabaseSync, projectId: string): string | undefined {
  const row = db.prepare("SELECT key FROM projects WHERE id = ?").get(projectId) as { key: string } | undefined;
  return row?.key;
}

export async function rollupParentStatus(
  db: DatabaseSync,
  entityId: string,
  options?: { projectKey?: string; maxDepth?: number }
): Promise<RollupParentResult> {
  const maxDepth = options?.maxDepth ?? 16;
  const updatedIds: string[] = [];
  const derived: RollupParentResult["derived"] = [];

  let current = await entities.get(db, entityId);
  if (!current || !isProcessEntityType(current.type)) {
    return { updatedIds, derived };
  }

  const projectKey = options?.projectKey ?? projectKeyForEntity(db, current.projectId);

  for (let depth = 0; depth < maxDepth; depth++) {
    const parent = await findProcessParent(db, current);
    if (!parent || !isProcessEntityType(parent.type)) {
      break;
    }

    const graphEntities = await entities.list(db, { projectKey });
    const listedRelations = await relations.list(db, { projectKey });
    const childStatuses = processChildrenStatuses(parent, graphEntities, listedRelations);
    const next = deriveParentProcessStatus(childStatuses, parent.status);
    if (!next || next === parent.status) {
      current = parent;
      continue;
    }

    await entities.update(db, {
      id: parent.id,
      patch: { status: next },
      skipRollup: true
    });
    updatedIds.push(parent.id);
    derived.push({ id: parent.id, from: parent.status, to: next });
    current = { ...parent, status: next };
  }

  return { updatedIds, derived };
}

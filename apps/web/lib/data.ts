import path from "node:path";
import type { Entity, EntityRelation, Tag } from "@projectplaner/core";
import { getTagsForEntity } from "@projectplaner/core";
import {
  createDatabase,
  getEntity,
  getProjectSnapshot,
  listRelations
} from "@projectplaner/db";

function openDb() {
  return createDatabase(process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db"));
}

export async function loadProject(key = "PLAN") {
  const db = openDb();

  try {
    return await getProjectSnapshot(db, key);
  } finally {
    db.close();
  }
}

export type EntityDetailRelation = {
  relation: EntityRelation;
  direction: "outgoing" | "incoming";
  other: Entity | null;
};

export type EntityDetailData = {
  project: {
    id: string;
    key: string;
    title: string;
    description: string;
  };
  entity: Entity;
  relations: EntityDetailRelation[];
  tags: Tag[];
  notes: Entity[];
  references: Entity[];
  relatedWork: Entity[];
};

export async function loadEntityDetail(projectKey: string, entityId: string): Promise<EntityDetailData | null> {
  const db = openDb();

  try {
    const snapshot = await getProjectSnapshot(db, projectKey);
    if (!snapshot) {
      return null;
    }

    const entity = await getEntity(db, entityId);
    if (!entity || entity.projectId !== snapshot.project.id) {
      return null;
    }

    const [outgoing, incoming] = await Promise.all([
      listRelations(db, { projectKey, sourceEntityId: entityId }),
      listRelations(db, { projectKey, targetEntityId: entityId })
    ]);

    const relatedIds = [
      ...new Set([
        ...outgoing.map((relation) => relation.targetEntityId),
        ...incoming.map((relation) => relation.sourceEntityId)
      ])
    ];
    const relatedEntities = await Promise.all(relatedIds.map((id) => getEntity(db, id)));
    const relatedById = new Map(
      relatedEntities.filter((item): item is Entity => Boolean(item)).map((item) => [item.id, item])
    );

    const relations: EntityDetailRelation[] = [
      ...outgoing.map((relation) => ({
        relation,
        direction: "outgoing" as const,
        other: relatedById.get(relation.targetEntityId) ?? null
      })),
      ...incoming.map((relation) => ({
        relation,
        direction: "incoming" as const,
        other: relatedById.get(relation.sourceEntityId) ?? null
      }))
    ];

    const related = [...relatedById.values()];
    const notes = related.filter((item) => item.type === "entry");
    const references = related.filter((item) => item.type === "reference");
    const relatedWork = related.filter((item) => item.type === "task" || item.type === "feature");

    return {
      project: snapshot.project,
      entity,
      relations,
      tags: getTagsForEntity({ type: entity.type, id: entity.id }, snapshot),
      notes,
      references,
      relatedWork
    };
  } finally {
    db.close();
  }
}

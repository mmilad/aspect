import type { Entity, EntityRelation, Tag } from "@projectplaner/core";
import { getTagsForEntity } from "@projectplaner/core";
import {
  getProjectSnapshot,
  getProjectStats,
  listProjects,
  listRelations,
  type ProjectStats,
  type ProjectSummary
} from "@projectplaner/db";
import { createWebPlanApi, withDb } from "./plan-api";

export async function loadProject(key = "PLAN") {
  return withDb(async (db) => getProjectSnapshot(db, key));
}

export async function loadProjects(): Promise<ProjectSummary[]> {
  return withDb(async (db) => listProjects(db));
}

export async function loadProjectStats(key: string): Promise<ProjectStats | null> {
  return withDb(async (db) => getProjectStats(db, key));
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
  return withDb(async (db) => {
    const snapshot = await getProjectSnapshot(db, projectKey);
    if (!snapshot) {
      return null;
    }

    const api = createWebPlanApi(db);
    const entity = await api.entities.get(entityId, { select: "full" });
    if (!entity || !("projectId" in entity) || entity.projectId !== snapshot.project.id) {
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
    const relatedEntities = await Promise.all(
      relatedIds.map((id) => api.entities.get(id, { select: "full" }))
    );
    const relatedById = new Map(
      relatedEntities
        .filter((item): item is Entity => Boolean(item) && "projectId" in (item as object))
        .map((item) => [item.id, item as Entity])
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
      entity: entity as Entity,
      relations,
      tags: getTagsForEntity({ type: entity.type, id: entity.id }, snapshot),
      notes,
      references,
      relatedWork
    };
  });
}

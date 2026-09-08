import type { Storage } from "../contracts/storage";
import type { Entity, EntityType } from "@projectplaner/core";
import type { CreateAspectInput, CreateFeatureInput, CreateSemanticTaskInput } from "./writes";
import { rollupParentStatus } from "../rollup";
type EntityOfType<T extends EntityType> = Entity & { type: T };
export async function createAspect(db: Storage, projectKey: string, input: CreateAspectInput): Promise<EntityOfType<"aspect">> {
  const parent = input.parentId ? await requireEntity(db, projectKey, input.parentId, ["aspect", "project"]) : null;
  const created = await db.entities.create({
    projectKey: projectKey,
    type: "aspect",
    title: input.title,
    key: input.key,
    slug: input.slug,
    summary: input.summary,
    body: input.body,
    metadata: input.metadata,
    skipRollup: Boolean(parent)
  });

  if (parent) {
    await db.relations.create({
      projectKey: projectKey,
      sourceEntityId: parent.id,
      targetEntityId: created.entity.id,
      type: "contains",
      isPrimary: true
    });
    await rollupParentStatus(db, created.entity.id, { projectKey: projectKey });
  }

  return created.entity as EntityOfType<"aspect">;
}
export async function createFeature(db: Storage, projectKey: string, input: CreateFeatureInput): Promise<EntityOfType<"feature">> {
  const parent = await requireEntity(db, projectKey, input.parentId, ["aspect", "feature"]);
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.acceptanceShape ? { acceptanceShape: input.acceptanceShape } : {})
  };
  const created = await db.entities.create({
    projectKey: projectKey,
    type: "feature",
    title: input.title,
    key: input.key,
    slug: input.slug,
    summary: input.summary,
    body: input.body,
    metadata,
    skipRollup: true
  });
  await db.relations.create({
    projectKey: projectKey,
    sourceEntityId: parent.id,
    targetEntityId: created.entity.id,
    type: "contains",
    isPrimary: true
  });
  await rollupParentStatus(db, created.entity.id, { projectKey: projectKey });
  return created.entity as EntityOfType<"feature">;
}
export async function createTask(db: Storage, projectKey: string, input: CreateSemanticTaskInput): Promise<EntityOfType<"task">> {
  const target = await requireEntity(db, projectKey, input.targetId, ["aspect", "feature"]);
  const linkType = input.linkType ?? (target.type === "feature" ? "implements" : "affects");
  const created = await db.entities.create({
    projectKey: projectKey,
    type: "task",
    title: input.title,
    key: input.key,
    slug: input.slug,
    summary: input.summary,
    body: input.body ?? input.summary,
    metadata: {
      ...(input.metadata ?? {}),
      priority: input.priority ?? "medium",
      acceptanceCriteria: input.acceptanceCriteria ?? []
    },
    relations: [{ targetEntityId: target.id, type: linkType, isPrimary: true }]
  });
  return created.entity as EntityOfType<"task">;
}
export async function requireEntity<T extends EntityType>(db: Storage, projectKey: string, id: string, allowed: T[]): Promise<EntityOfType<T>> {
  const entity = await db.entities.get(id);
  if (!entity || !allowed.includes(entity.type as T)) {
    throw new Error(`Expected ${allowed.join(" or ")} entity: ${id}`);
  }
  return entity as EntityOfType<T>;
}

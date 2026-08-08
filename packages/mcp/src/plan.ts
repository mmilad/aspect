import path from "node:path";
import { entitySearchValues, rankedByQuery, type Entity, type EntityRelation, type EntityRelationType, type EntityStatus, type EntityType, type JsonRecord } from "@projectplaner/core";
import {
  createDatabase,
  createEntity,
  createRelation,
  getEntity,
  listEntities,
  listRelations,
  updateEntity
} from "@projectplaner/db";

const DEFAULT_PROJECT_KEY = "PLAN";

type Db = ReturnType<typeof createDatabase>;

let queue: Promise<unknown> = Promise.resolve();

function resolveDbPath(): string | undefined {
  return process.env.PROJECTPLANER_DB_PATH;
}

async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = createDatabase(resolveDbPath());
    try {
      return await fn(db);
    } finally {
      db.close();
    }
  });
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function compactEntity(entity: Entity) {
  return {
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    status: entity.status,
    summary: entity.summary || entity.body || ""
  };
}

function isOrientationPacket(entity: Entity, workflow?: string): boolean {
  if (entity.type !== "reference") {
    return false;
  }
  if (workflow && entity.metadata.workflow !== workflow) {
    return false;
  }
  return entity.metadata.kind === "orientation_packet" || typeof entity.metadata.workflow === "string";
}

function relationTouchesPacket(relation: EntityRelation, entityId: string, packetIds: Set<string>): boolean {
  return (
    (relation.sourceEntityId === entityId && packetIds.has(relation.targetEntityId)) ||
    (relation.targetEntityId === entityId && packetIds.has(relation.sourceEntityId))
  );
}

function normalizePacketMetadata(metadata: JsonRecord, entityId: string, workflow?: string): JsonRecord {
  const targetIds = Array.isArray(metadata.targetIds) ? metadata.targetIds : [];
  return {
    ...metadata,
    kind: "orientation_packet",
    workflow: workflow ?? metadata.workflow ?? "task.consumption.handoff",
    targetIds: targetIds.includes(entityId) ? targetIds : [...targetIds, entityId],
    updatedAt: new Date().toISOString()
  };
}

export async function orient(query?: string, limit = 10) {
  return withDb(async (db) => {
    const entities = await listEntities(db, { projectKey: DEFAULT_PROJECT_KEY });
    const relations = await listRelations(db, { projectKey: DEFAULT_PROJECT_KEY });
    const project = entities.find((entity) => entity.type === "project");
    const matches = query
      ? rankedByQuery(entities, query, entitySearchValues).slice(0, limit)
      : entities
          .filter((entity) => entity.type === "aspect")
          .slice(0, limit)
          .map((item) => ({ item, score: 0 }));

    const seedIds = new Set(matches.slice(0, 3).map((match) => match.item.id));
    if (!query && project) {
      seedIds.add(project.id);
    }

    const neighborhoodRelations = relations
      .filter((relation) => seedIds.has(relation.sourceEntityId) || seedIds.has(relation.targetEntityId))
      .slice(0, limit);

    const openTasks = entities
      .filter((entity) => entity.type === "task" && entity.status !== "done")
      .filter(
        (task) =>
          seedIds.has(task.id) ||
          relations.some((relation) => relation.sourceEntityId === task.id && seedIds.has(relation.targetEntityId))
      )
      .slice(0, limit)
      .map(compactEntity);

    return {
      project: project ? { key: project.key, title: project.title } : { key: DEFAULT_PROJECT_KEY },
      query: query ?? "",
      matches: matches.map((match) => ({ score: match.score, ...compactEntity(match.item) })),
      relations: neighborhoodRelations.map((relation) => ({
        id: relation.id,
        from: relation.sourceEntityId,
        type: relation.type,
        to: relation.targetEntityId,
        primary: relation.isPrimary
      })),
      openTasks,
      next: "Pick the smallest truthful Aspect or Feature, then get_entity / packet_read before broad code search."
    };
  });
}

export async function getPlanEntity(id: string) {
  return withDb(async (db) => {
    const entity = await getEntity(db, id);
    if (!entity) {
      throw new Error(`Entity not found: ${id}`);
    }
    return entity;
  });
}

export async function listPlanEntities(input: { type?: EntityType; query?: string; limit?: number }) {
  return withDb(async (db) => {
    const entities = await listEntities(db, {
      projectKey: DEFAULT_PROJECT_KEY,
      type: input.type,
      query: input.query
    });
    return entities.slice(0, input.limit ?? 50).map(compactEntity);
  });
}

export async function createPlanEntity(input: {
  type: EntityType;
  title: string;
  summary?: string;
  body?: string;
  status?: EntityStatus;
  key?: string;
  slug?: string;
  metadata?: JsonRecord;
  targetEntityId?: string;
  linkType?: EntityRelationType;
  priority?: string;
  acceptanceCriteria?: string[];
}) {
  return withDb(async (db) => {
    if (input.type === "task" && !input.targetEntityId) {
      throw new Error("create_entity for tasks requires targetEntityId (Aspect or Feature).");
    }

    if (input.targetEntityId) {
      const target = await getEntity(db, input.targetEntityId);
      if (!target) {
        throw new Error(`Target entity not found: ${input.targetEntityId}`);
      }
      if (input.type === "task" && target.type !== "aspect" && target.type !== "feature") {
        throw new Error("Task targets must be Aspect or Feature entities.");
      }
    }

    const linkType =
      input.linkType ??
      (input.type === "feature" ? "implements" : input.type === "aspect" ? "contains" : "affects");
    const metadata: JsonRecord = { ...(input.metadata ?? {}) };
    if (input.type === "task") {
      metadata.priority = input.priority ?? metadata.priority ?? "medium";
      metadata.acceptanceCriteria = input.acceptanceCriteria ?? metadata.acceptanceCriteria ?? [];
    }

    const parentContainsChild = input.type === "aspect" && input.targetEntityId && linkType === "contains";
    const result = await createEntity(db, {
      projectKey: DEFAULT_PROJECT_KEY,
      type: input.type,
      title: input.title,
      key: input.key,
      slug: input.slug,
      summary: input.summary,
      body: input.body ?? input.summary,
      status: input.status,
      metadata,
      relations:
        input.targetEntityId && !parentContainsChild
          ? [{ targetEntityId: input.targetEntityId, type: linkType, isPrimary: true }]
          : []
    });

    if (parentContainsChild && input.targetEntityId) {
      await createRelation(db, {
        projectKey: DEFAULT_PROJECT_KEY,
        sourceEntityId: input.targetEntityId,
        targetEntityId: result.entity.id,
        type: "contains",
        isPrimary: true
      });
    }

    return { entity: compactEntity(result.entity), warnings: result.warnings };
  });
}

export async function updatePlanEntity(input: {
  id: string;
  title?: string;
  summary?: string;
  body?: string;
  status?: EntityStatus;
  key?: string;
  slug?: string;
  metadata?: JsonRecord;
}) {
  return withDb(async (db) => {
    const existing = await getEntity(db, input.id);
    if (!existing) {
      throw new Error(`Entity not found: ${input.id}`);
    }
    const entity = await updateEntity(db, {
      id: input.id,
      patch: {
        title: input.title ?? existing.title,
        summary: input.summary ?? existing.summary,
        body: input.body ?? existing.body,
        status: input.status ?? existing.status,
        key: input.key ?? existing.key,
        slug: input.slug ?? existing.slug,
        metadata: input.metadata ?? existing.metadata
      }
    });
    return compactEntity(entity);
  });
}

export async function createPlanRelation(input: {
  from: string;
  to: string;
  type: EntityRelationType;
  label?: string;
  primary?: boolean;
  metadata?: JsonRecord;
}) {
  return withDb(async (db) => {
    const relation = await createRelation(db, {
      projectKey: DEFAULT_PROJECT_KEY,
      sourceEntityId: input.from,
      targetEntityId: input.to,
      type: input.type,
      label: input.label,
      isPrimary: input.primary ?? false,
      metadata: input.metadata ?? {}
    });
    return {
      id: relation.id,
      from: relation.sourceEntityId,
      type: relation.type,
      to: relation.targetEntityId,
      primary: relation.isPrimary
    };
  });
}

export async function packetRead(entityId: string, workflow?: string) {
  return withDb(async (db) => {
    const entity = await getEntity(db, entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    const references = await listEntities(db, { projectKey: DEFAULT_PROJECT_KEY, type: "reference" });
    const packetIds = new Set(references.filter((reference) => isOrientationPacket(reference, workflow)).map((reference) => reference.id));
    const relations = await listRelations(db, { projectKey: DEFAULT_PROJECT_KEY });
    const attachedIds = new Set(
      relations
        .filter((relation) => relationTouchesPacket(relation, entityId, packetIds))
        .map((relation) => (relation.sourceEntityId === entityId ? relation.targetEntityId : relation.sourceEntityId))
    );
    return references.filter((reference) => attachedIds.has(reference.id));
  });
}

export async function packetWrite(input: {
  entityId: string;
  metadata: JsonRecord;
  id?: string;
  title?: string;
  summary?: string;
  body?: string;
  workflow?: string;
}) {
  return withDb(async (db) => {
    const target = await getEntity(db, input.entityId);
    if (!target) {
      throw new Error(`Entity not found: ${input.entityId}`);
    }
    const metadata = normalizePacketMetadata(input.metadata, input.entityId, input.workflow);
    const packet = input.id
      ? await updateEntity(db, {
          id: input.id,
          patch: {
            metadata,
            title: input.title ?? (await getEntity(db, input.id))?.title ?? "Orientation Packet"
          }
        })
      : (
          await createEntity(db, {
            projectKey: DEFAULT_PROJECT_KEY,
            type: "reference",
            title: input.title ?? `Orientation Packet for ${target.key ?? target.title}`,
            summary: input.summary ?? "Compact machine-oriented handoff packet.",
            body: input.body ?? "Compact machine-oriented handoff packet.",
            metadata
          })
        ).entity;

    const existingRelations = await listRelations(db, {
      projectKey: DEFAULT_PROJECT_KEY,
      sourceEntityId: input.entityId,
      targetEntityId: packet.id
    });
    if (existingRelations.length === 0) {
      await createRelation(db, {
        projectKey: DEFAULT_PROJECT_KEY,
        sourceEntityId: input.entityId,
        targetEntityId: packet.id,
        type: "references",
        label: "orientation packet",
        isPrimary: false
      });
    }

    return compactEntity(packet);
  });
}

export function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }]
  };
}

export function errorResult(error: unknown) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }]
  };
}

/** Exposed for tests that need a known absolute DB path. */
export function databasePathHint(): string {
  return resolveDbPath() ?? path.resolve(process.cwd(), "projectplaner.db");
}

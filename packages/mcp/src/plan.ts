import path from "node:path";
import {
  createPlanApi,
  getNarrative,
  withNarrative,
  type Entity,
  type EntityNarrative,
  type EntityRelationType,
  type EntityStatus,
  type EntityType,
  type JsonRecord
} from "@projectplaner/core";
import {
  createDatabase,
  createEntity,
  createRelation,
  createSqliteEntityStore,
  getEntity,
  listRelations,
  updateEntity
} from "@projectplaner/db";

const DEFAULT_PROJECT_KEY = "PLAN";
const SUMMARY_MAX = 240;
const BODY_MAX = 2000;
const DEFAULT_LIST_LIMIT = 30;

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

function planApi(db: Db) {
  return createPlanApi(createSqliteEntityStore(db));
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

function requireReason(reason: string | undefined, action: string): string {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`${action} requires reason (durable narrative for the next agent).`);
  }
  return trimmed;
}

function mergeNarrativeMetadata(
  existing: JsonRecord,
  narrative: EntityNarrative,
  updatedBy = "agent"
): JsonRecord {
  const current = typeof existing.narrative === "object" && existing.narrative && !Array.isArray(existing.narrative)
    ? (existing.narrative as EntityNarrative)
    : {};
  return {
    ...existing,
    narrative: {
      ...current,
      ...narrative,
      updatedAt: new Date().toISOString(),
      updatedBy: narrative.updatedBy ?? updatedBy
    }
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

const PACKET_METADATA_KEYS = [
  "kind",
  "workflow",
  "state",
  "next",
  "confidence",
  "targetIds",
  "updatedAt"
] as const;

function compactPacketMetadata(metadata: JsonRecord): JsonRecord {
  const out: JsonRecord = {};
  for (const key of PACKET_METADATA_KEYS) {
    if (metadata[key] !== undefined) {
      out[key] = metadata[key];
    }
  }
  return out;
}

function compactPacket(entity: Entity) {
  return {
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    status: entity.status,
    summary: truncate(entity.summary || entity.body || "", SUMMARY_MAX),
    metadata: compactPacketMetadata(entity.metadata)
  };
}

function normalizePacketMetadata(metadata: JsonRecord, entityId: string, workflow?: string): JsonRecord {
  const targetIds = Array.isArray(metadata.targetIds) ? metadata.targetIds : [];
  const next = typeof metadata.next === "string" ? metadata.next.trim() : "";
  if (!next) {
    throw new Error("packet_write requires metadata.next (what the next agent should do).");
  }
  const state = typeof metadata.state === "string" ? metadata.state.trim() : "";
  if (!state) {
    throw new Error("packet_write requires metadata.state.");
  }
  return {
    ...metadata,
    kind: "orientation_packet",
    workflow: workflow ?? metadata.workflow ?? "task.consumption.handoff",
    state,
    next,
    targetIds: targetIds.includes(entityId) ? targetIds : [...targetIds, entityId],
    updatedAt: new Date().toISOString()
  };
}

/** One-time onboarding for new agents — not a graph search. */
export function orientBriefing() {
  return {
    project: { key: DEFAULT_PROJECT_KEY },
    purpose: "Local graph-first planning store. Aspects are meaning anchors; features and tasks attach to them.",
    rules: [
      "Serialize all Projectplaner tool calls (no parallel DB tools).",
      "Prefer the smallest truthful Aspect or Feature before creating new anchors.",
      "Every task must link to an Aspect or Feature (targetEntityId).",
      "Writes must include reason (durable narrative for the next agent).",
      "Use search for relevant context; use next_work to pick eligible tasks.",
      "Leave narrative.proposal / openQuestions when useful; use packet_write for execution handoffs."
    ],
    tools: {
      search: "Relevance search (titles, summaries, narrative.reason/proposal/…).",
      next_work: "Eligible tasks ranked by work score (unblocked candidates).",
      get_entity: "Compact entity + narrative by default.",
      list_entities: "Filtered list (type / optional text filter).",
      create_entity: "Create node; requires reason.",
      update_entity: "Update node; requires reason.",
      create_relation: "Link two entities.",
      packet_read: "Read orientation packets on an entity.",
      packet_write: "Write handoff packet; requires state+next; also stamps target narrative."
    },
    next: "Call search with a short work-area query, or next_work if you need an eligible task."
  };
}

export async function searchPlanEntities(input: {
  q: string;
  type?: EntityType;
  limit?: number;
  relatedTo?: string;
}) {
  return withDb(async (db) => {
    const api = planApi(db);
    const typed =
      input.type === "task"
        ? api.tasks
        : input.type === "aspect"
          ? api.aspects
          : input.type === "feature"
            ? api.features
            : input.type === "reference"
              ? api.references
              : api.entities;

    const where = input.relatedTo
      ? {
          rel: {
            direction: "out" as const,
            some: { field: "id" as const, op: "eq" as const, value: input.relatedTo }
          }
        }
      : input.type && typed === api.entities
        ? { field: "type" as const, op: "eq" as const, value: input.type }
        : undefined;

    const result = await typed.search({
      projectKey: DEFAULT_PROJECT_KEY,
      q: input.q,
      where,
      limit: input.limit ?? 10,
      select: "compact",
      includeNarrative: true
    });
    return { items: result.items, meta: result.meta };
  });
}

export async function nextWork(input: { relatedTo?: string; limit?: number } = {}) {
  return withDb(async (db) => {
    const api = planApi(db);
    const result = await api.tasks.nextWork({
      projectKey: DEFAULT_PROJECT_KEY,
      relatedTo: input.relatedTo ? { id: input.relatedTo } : undefined,
      limit: input.limit ?? 10,
      select: "compact",
      includeNarrative: true
    });
    return { items: result.items, meta: result.meta };
  });
}

export async function getPlanEntity(
  id: string,
  options: { includeBody?: boolean; includeMetadata?: boolean } = {}
) {
  return withDb(async (db) => {
    const api = planApi(db);
    const entity = await api.entities.get(id, {
      select: options.includeBody || options.includeMetadata ? "full" : "compact",
      includeNarrative: true
    });
    if (!entity) {
      throw new Error(`Entity not found: ${id}`);
    }
    if (!options.includeBody && !options.includeMetadata) {
      return entity;
    }
    const full = await getEntity(db, id);
    if (!full) {
      throw new Error(`Entity not found: ${id}`);
    }
    const detail: Record<string, unknown> = {
      ...entity,
      narrative: getNarrative(full)
    };
    if (options.includeBody && full.body) {
      detail.body = truncate(full.body, BODY_MAX);
    }
    if (options.includeMetadata) {
      detail.metadata = full.metadata;
    }
    if (full.type === "task") {
      detail.priority =
        typeof full.metadata.priority === "string" ? full.metadata.priority : "medium";
      detail.acceptanceCriteria = Array.isArray(full.metadata.acceptanceCriteria)
        ? full.metadata.acceptanceCriteria.filter((item): item is string => typeof item === "string")
        : [];
    }
    return detail;
  });
}

export async function listPlanEntities(input: {
  type?: EntityType;
  query?: string;
  limit?: number;
  unblocked?: boolean;
  relatedTo?: string;
}) {
  return withDb(async (db) => {
    const api = planApi(db);
    if (input.type === "task") {
      const result = await api.tasks.list({
        projectKey: DEFAULT_PROJECT_KEY,
        unblocked: input.unblocked,
        relatedTo: input.relatedTo ? { id: input.relatedTo } : undefined,
        where: input.query?.trim()
          ? { field: "q", op: "match", value: input.query.trim() }
          : undefined,
        limit: input.limit ?? DEFAULT_LIST_LIMIT,
        select: "compact",
        includeNarrative: true
      });
      return { items: result.items, meta: result.meta };
    }

    const result = await api.entities.list({
      projectKey: DEFAULT_PROJECT_KEY,
      where: (() => {
        const parts = [];
        if (input.type) {
          parts.push({ field: "type" as const, op: "eq" as const, value: input.type });
        }
        if (input.query?.trim()) {
          parts.push({ field: "q" as const, op: "match" as const, value: input.query.trim() });
        }
        if (input.relatedTo) {
          parts.push({
            rel: {
              direction: "out" as const,
              some: { field: "id" as const, op: "eq" as const, value: input.relatedTo }
            }
          });
        }
        if (parts.length === 0) {
          return undefined;
        }
        if (parts.length === 1) {
          return parts[0];
        }
        return { and: parts };
      })(),
      limit: input.limit ?? DEFAULT_LIST_LIMIT,
      select: "compact",
      includeNarrative: true
    });
    return { items: result.items, meta: result.meta };
  });
}

export async function createPlanEntity(input: {
  type: EntityType;
  title: string;
  reason: string;
  proposal?: string;
  intent?: string;
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
  const reason = requireReason(input.reason, "create_entity");
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
    let metadata: JsonRecord = { ...(input.metadata ?? {}) };
    if (input.type === "task") {
      metadata.priority = input.priority ?? metadata.priority ?? "medium";
      metadata.acceptanceCriteria = input.acceptanceCriteria ?? metadata.acceptanceCriteria ?? [];
    }
    metadata = mergeNarrativeMetadata(metadata, {
      reason,
      proposal: input.proposal,
      intent: input.intent
    });

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

    const api = planApi(db);
    const view = await api.entities.get(result.entity.id, { select: "compact", includeNarrative: true });
    return { entity: view, warnings: result.warnings };
  });
}

export async function updatePlanEntity(input: {
  id: string;
  reason: string;
  proposal?: string;
  intent?: string;
  title?: string;
  summary?: string;
  body?: string;
  status?: EntityStatus;
  key?: string;
  slug?: string;
  metadata?: JsonRecord;
}) {
  const reason = requireReason(input.reason, "update_entity");
  return withDb(async (db) => {
    const existing = await getEntity(db, input.id);
    if (!existing) {
      throw new Error(`Entity not found: ${input.id}`);
    }
    const metadata = mergeNarrativeMetadata(
      { ...existing.metadata, ...(input.metadata ?? {}) },
      { reason, proposal: input.proposal, intent: input.intent }
    );
    const entity = await updateEntity(db, {
      id: input.id,
      patch: {
        title: input.title ?? existing.title,
        summary: input.summary ?? existing.summary,
        body: input.body ?? existing.body,
        status: input.status ?? existing.status,
        key: input.key ?? existing.key,
        slug: input.slug ?? existing.slug,
        metadata
      }
    });
    const api = planApi(db);
    return api.entities.get(entity.id, { select: "compact", includeNarrative: true });
  });
}

export async function createPlanRelation(input: {
  from: string;
  to: string;
  type: EntityRelationType;
  label?: string;
  primary?: boolean;
  metadata?: JsonRecord;
  reason?: string;
}) {
  return withDb(async (db) => {
    const relation = await createRelation(db, {
      projectKey: DEFAULT_PROJECT_KEY,
      sourceEntityId: input.from,
      targetEntityId: input.to,
      type: input.type,
      label: input.label,
      isPrimary: input.primary ?? false,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.reason?.trim()
          ? { narrative: { reason: input.reason.trim(), updatedAt: new Date().toISOString(), updatedBy: "agent" } }
          : {})
      }
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

    const [outgoing, incoming] = await Promise.all([
      listRelations(db, { projectKey: DEFAULT_PROJECT_KEY, sourceEntityId: entityId }),
      listRelations(db, { projectKey: DEFAULT_PROJECT_KEY, targetEntityId: entityId })
    ]);

    const neighborIds = [
      ...new Set([
        ...outgoing.map((relation) => relation.targetEntityId),
        ...incoming.map((relation) => relation.sourceEntityId)
      ])
    ];

    const neighbors = (await Promise.all(neighborIds.map((id) => getEntity(db, id)))).filter(
      (item): item is Entity => item != null
    );
    const packets = neighbors.filter((item) => isOrientationPacket(item, workflow)).map(compactPacket);
    return {
      packets,
      targetNarrative: getNarrative(entity),
      hint:
        packets.length === 0
          ? "No packets; use get_entity narrative / search, or packet_write after work."
          : undefined
    };
  });
}

export async function packetWrite(input: {
  entityId: string;
  metadata: JsonRecord;
  reason: string;
  proposal?: string;
  id?: string;
  title?: string;
  summary?: string;
  body?: string;
  workflow?: string;
}) {
  const reason = requireReason(input.reason, "packet_write");
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

    // Stamp durable narrative on the target so the next agent can search/read it without the packet.
    await updateEntity(db, {
      id: target.id,
      patch: {
        metadata: mergeNarrativeMetadata(target.metadata, {
          reason,
          proposal: input.proposal ?? (typeof metadata.next === "string" ? metadata.next : undefined)
        })
      }
    });

    return {
      packet: compactPacket(packet),
      targetNarrative: getNarrative(withNarrative(target, { reason, proposal: input.proposal }))
    };
  });
}

export function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }]
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

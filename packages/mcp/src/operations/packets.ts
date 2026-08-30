import type { Entity, JsonRecord } from "@projectplaner/core";
import domain from "@projectplaner/core/domain";

const { getNarrative, withNarrative } = domain;
import entities from "@projectplaner/db/entities";
import relations from "@projectplaner/db/relations";
import {
  DEFAULT_PROJECT_KEY,
  mergeNarrativeMetadata,
  requireReason,
  SUMMARY_MAX,
  truncate,
  withDb
} from "./session";

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

export async function packetRead(entityId: string, workflow?: string) {
  return withDb(async (db) => {
    const entity = await entities.get(db, entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const [outgoing, incoming] = await Promise.all([
      relations.list(db, { projectKey: DEFAULT_PROJECT_KEY, sourceEntityId: entityId }),
      relations.list(db, { projectKey: DEFAULT_PROJECT_KEY, targetEntityId: entityId })
    ]);

    const neighborIds = [
      ...new Set([
        ...outgoing.map((relation) => relation.targetEntityId),
        ...incoming.map((relation) => relation.sourceEntityId)
      ])
    ];

    const neighbors = (await Promise.all(neighborIds.map((id) => entities.get(db, id)))).filter(
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
    const target = await entities.get(db, input.entityId);
    if (!target) {
      throw new Error(`Entity not found: ${input.entityId}`);
    }
    const metadata = normalizePacketMetadata(input.metadata, input.entityId, input.workflow);
    const packet = input.id
      ? await entities.update(db, {
          id: input.id,
          patch: {
            metadata,
            title: input.title ?? (await entities.get(db, input.id))?.title ?? "Orientation Packet"
          }
        })
      : (
          await entities.create(db, {
            projectKey: DEFAULT_PROJECT_KEY,
            type: "reference",
            title: input.title ?? `Orientation Packet for ${target.key ?? target.title}`,
            summary: input.summary ?? "Compact machine-oriented handoff packet.",
            body: input.body ?? "Compact machine-oriented handoff packet.",
            metadata
          })
        ).entity;

    const existingRelations = await relations.list(db, {
      projectKey: DEFAULT_PROJECT_KEY,
      sourceEntityId: input.entityId,
      targetEntityId: packet.id
    });
    if (existingRelations.length === 0) {
      await relations.create(db, {
        projectKey: DEFAULT_PROJECT_KEY,
        sourceEntityId: input.entityId,
        targetEntityId: packet.id,
        type: "references",
        label: "orientation packet",
        isPrimary: false
      });
    }

    await entities.update(db, {
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

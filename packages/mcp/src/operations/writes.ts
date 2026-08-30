import type { EntityRelationType, EntityStatus, EntityType, JsonRecord } from "@projectplaner/core";
import entities from "@projectplaner/db/entities";
import relations from "@projectplaner/db/relations";
import {
  assertNoSeededMutationPreset,
  DEFAULT_PROJECT_KEY,
  mergeNarrativeMetadata,
  planApi,
  requireReason,
  withDb
} from "./session";

export async function createEntity(input: {
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
    assertNoSeededMutationPreset(db, "create", input.type);
    if (input.type === "task" && !input.targetEntityId) {
      throw new Error("create_entity for tasks requires targetEntityId (Aspect or Feature).");
    }

    if (input.targetEntityId) {
      const target = await entities.get(db, input.targetEntityId);
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
    const result = await entities.create(db, {
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
      await relations.create(db, {
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

export async function updateEntity(input: {
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
    const existing = await entities.get(db, input.id);
    if (!existing) {
      throw new Error(`Entity not found: ${input.id}`);
    }
    const op = input.status === "archived" && existing.status !== "archived" ? "delete" : "update";
    assertNoSeededMutationPreset(db, op, existing.type);
    const metadata = mergeNarrativeMetadata(
      { ...existing.metadata, ...(input.metadata ?? {}) },
      { reason, proposal: input.proposal, intent: input.intent }
    );
    const entity = await entities.update(db, {
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

export async function createRelation(input: {
  from: string;
  to: string;
  type: EntityRelationType;
  label?: string;
  primary?: boolean;
  metadata?: JsonRecord;
  reason?: string;
}) {
  return withDb(async (db) => {
    const relation = await relations.create(db, {
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

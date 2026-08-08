import type { Entity, JsonRecord } from "./types";

/**
 * Shared durable write-back context on any entity.
 * Stored at `metadata.narrative`. Forward-compatible: unknown keys are preserved.
 */
export type EntityNarrative = {
  reason?: string;
  proposal?: string;
  intent?: string;
  assumptions?: string[];
  openQuestions?: string[];
  evidence?: string[];
  updatedAt?: string;
  updatedBy?: "agent" | "human" | string;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : [];
}

/** Read typed narrative envelope from entity metadata (empty object if absent). */
export function getNarrative(entity: Entity): EntityNarrative {
  const raw = entity.metadata.narrative;
  if (!isRecord(raw)) {
    return {};
  }

  const narrative: EntityNarrative = { ...raw };
  if (typeof raw.reason === "string") {
    narrative.reason = raw.reason;
  }
  if (typeof raw.proposal === "string") {
    narrative.proposal = raw.proposal;
  }
  if (typeof raw.intent === "string") {
    narrative.intent = raw.intent;
  }
  const assumptions = asStringArray(raw.assumptions);
  if (assumptions) {
    narrative.assumptions = assumptions;
  }
  const openQuestions = asStringArray(raw.openQuestions);
  if (openQuestions) {
    narrative.openQuestions = openQuestions;
  }
  const evidence = asStringArray(raw.evidence);
  if (evidence) {
    narrative.evidence = evidence;
  }
  if (typeof raw.updatedAt === "string") {
    narrative.updatedAt = raw.updatedAt;
  }
  if (typeof raw.updatedBy === "string") {
    narrative.updatedBy = raw.updatedBy;
  }
  return narrative;
}

/** Merge narrative patch into metadata without clobbering other metadata keys. */
export function withNarrative(entity: Entity, patch: EntityNarrative): Entity {
  const current = getNarrative(entity);
  const next: EntityNarrative = {
    ...current,
    ...patch,
    assumptions: patch.assumptions ?? current.assumptions,
    openQuestions: patch.openQuestions ?? current.openQuestions,
    evidence: patch.evidence ?? current.evidence
  };
  return {
    ...entity,
    metadata: {
      ...entity.metadata,
      narrative: next
    }
  };
}

/** Flatten narrative for relevance search corpora. */
export function narrativeSearchValues(entity: Entity): Array<string | null | undefined> {
  const narrative = getNarrative(entity);
  return [
    narrative.reason,
    narrative.proposal,
    narrative.intent,
    ...(narrative.assumptions ?? []),
    ...(narrative.openQuestions ?? []),
    ...(narrative.evidence ?? [])
  ];
}

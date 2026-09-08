import type { EntityType } from "@projectplaner/core";
import domain from "@projectplaner/core/domain";

const { getNarrative } = domain;

import { BODY_MAX, DEFAULT_LIST_LIMIT, DEFAULT_PROJECT_KEY, planApi, truncate, withDb } from "./session";

export async function searchEntities(input: {
  q: string;
  type?: EntityType;
  limit?: number;
  relatedTo?: string;
  includeArchived?: boolean;
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
      includeNarrative: true,
      includeArchived: input.includeArchived
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

export async function getEntity(
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
    const full = await db.entities.get(id);
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
      detail.priority = typeof full.metadata.priority === "string" ? full.metadata.priority : "medium";
      detail.acceptanceCriteria = Array.isArray(full.metadata.acceptanceCriteria)
        ? full.metadata.acceptanceCriteria.filter((item): item is string => typeof item === "string")
        : [];
    }
    return detail;
  });
}

export async function listEntities(input: {
  type?: EntityType;
  query?: string;
  limit?: number;
  unblocked?: boolean;
  relatedTo?: string;
  includeArchived?: boolean;
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
        includeNarrative: true,
        includeArchived: input.includeArchived
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
      includeNarrative: true,
      includeArchived: input.includeArchived
    });
    return { items: result.items, meta: result.meta };
  });
}

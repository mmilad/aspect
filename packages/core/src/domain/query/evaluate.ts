import type { Entity, EntityRelation, EntityRelationType } from "../types";
import type { CompiledPredicate, EntityOrderBy, QueryPlan } from "./types";

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [String(value)];
}

function readField(entity: Entity, field: string): unknown {
  switch (field) {
    case "id":
      return entity.id;
    case "type":
      return entity.type;
    case "status":
      return entity.status;
    case "key":
      return entity.key;
    case "slug":
      return entity.slug;
    case "title":
      return entity.title;
    case "metadata.priority":
      return entity.metadata.priority;
    case "metadata.disabled":
      return entity.metadata.disabled === true;
    default:
      return undefined;
  }
}

function matchField(entity: Entity, predicate: Extract<CompiledPredicate, { kind: "field" }>): boolean {
  const actual = readField(entity, predicate.field);
  if (predicate.op === "eq") {
    if (predicate.field === "metadata.disabled") {
      return actual === Boolean(predicate.value);
    }
    return actual === predicate.value;
  }
  if (predicate.op === "neq") {
    if (predicate.field === "metadata.disabled") {
      return actual !== Boolean(predicate.value);
    }
    return actual !== predicate.value;
  }
  // in
  const values = asStringArray(predicate.value);
  if (predicate.field === "metadata.disabled") {
    return values.map((item) => item === "true").includes(Boolean(actual));
  }
  return values.includes(String(actual ?? ""));
}

function matchText(entity: Entity, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const haystack = [entity.title, entity.slug, entity.summary, entity.body].join(" ").toLowerCase();
  return haystack.includes(normalized);
}

function relatedEntities(
  entity: Entity,
  relations: EntityRelation[],
  entitiesById: Map<string, Entity>,
  direction: "out" | "in" | "either",
  types?: EntityRelationType[]
): Entity[] {
  const typeSet = types && types.length > 0 ? new Set(types) : null;
  const matchesType = (relation: EntityRelation) => (typeSet ? typeSet.has(relation.type) : true);
  const related: Entity[] = [];

  for (const relation of relations) {
    if (!matchesType(relation)) {
      continue;
    }
    if ((direction === "out" || direction === "either") && relation.sourceEntityId === entity.id) {
      const target = entitiesById.get(relation.targetEntityId);
      if (target) {
        related.push(target);
      }
    }
    if ((direction === "in" || direction === "either") && relation.targetEntityId === entity.id) {
      const source = entitiesById.get(relation.sourceEntityId);
      if (source) {
        related.push(source);
      }
    }
  }

  return related;
}

export function matchesPredicate(
  entity: Entity,
  predicate: CompiledPredicate,
  entitiesById: Map<string, Entity>,
  relations: EntityRelation[]
): boolean {
  switch (predicate.kind) {
    case "true":
      return true;
    case "field":
      return matchField(entity, predicate);
    case "match":
      return matchText(entity, predicate.value);
    case "and":
      return predicate.items.every((item) => matchesPredicate(entity, item, entitiesById, relations));
    case "or":
      return predicate.items.some((item) => matchesPredicate(entity, item, entitiesById, relations));
    case "not":
      return !matchesPredicate(entity, predicate.item, entitiesById, relations);
    case "rel": {
      const related = relatedEntities(entity, relations, entitiesById, predicate.direction, predicate.types);
      const relatedMatches = (item: Entity) =>
        predicate.relatedWhere
          ? matchesPredicate(item, predicate.relatedWhere, entitiesById, relations)
          : true;

      if (predicate.quantifier === "some") {
        return related.some(relatedMatches);
      }
      if (predicate.quantifier === "none") {
        return !related.some(relatedMatches);
      }
      // every — vacuous true when no related edges
      return related.every(relatedMatches);
    }
    default: {
      const _exhaustive: never = predicate;
      return _exhaustive;
    }
  }
}

function compareEntities(a: Entity, b: Entity, orderBy: EntityOrderBy[]): number {
  for (const order of orderBy) {
    const dir = order.dir === "desc" ? -1 : 1;
    let left: string | number;
    let right: string | number;
    if (order.field === "sortOrder") {
      left = a.sortOrder;
      right = b.sortOrder;
    } else if (order.field === "title") {
      left = a.title;
      right = b.title;
    } else {
      left = a.status;
      right = b.status;
    }
    if (left < right) {
      return -1 * dir;
    }
    if (left > right) {
      return 1 * dir;
    }
  }
  return a.id.localeCompare(b.id);
}

/**
 * Evaluate a QueryPlan against an in-memory graph.
 * Project scoping: when projectKey is set, only entities whose project matches
 * `projectKeyByProjectId` (or all entities if the map omits a project).
 */
export function evaluatePlan(
  plan: QueryPlan,
  entities: Entity[],
  relations: EntityRelation[],
  options?: { projectIdByKey?: Map<string, string> }
): Entity[] {
  const projectId = options?.projectIdByKey?.get(plan.projectKey);
  const scoped = projectId ? entities.filter((entity) => entity.projectId === projectId) : entities;
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));

  let matched = scoped.filter((entity) => matchesPredicate(entity, plan.where, entitiesById, relations));
  matched = [...matched].sort((a, b) => compareEntities(a, b, plan.orderBy));

  const offset = plan.offset ?? 0;
  if (offset > 0) {
    matched = matched.slice(offset);
  }
  if (typeof plan.limit === "number") {
    matched = matched.slice(0, plan.limit);
  }
  return matched;
}

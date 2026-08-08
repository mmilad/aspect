import { expandNamedPredicates } from "./expand";
import type { EntityType } from "../types";
import type {
  CompiledPredicate,
  EntityFilter,
  EntityListQuery,
  EntityOrderBy,
  QueryPlan,
  RelationFilter
} from "./types";

function compileFilter(filter: EntityFilter): CompiledPredicate {
  if ("and" in filter) {
    const items = filter.and.map(compileFilter);
    if (items.length === 0) {
      return { kind: "true" };
    }
    if (items.length === 1) {
      return items[0]!;
    }
    return { kind: "and", items };
  }

  if ("or" in filter) {
    const items = filter.or.map(compileFilter);
    if (items.length === 0) {
      return { kind: "true" };
    }
    if (items.length === 1) {
      return items[0]!;
    }
    return { kind: "or", items };
  }

  if ("not" in filter) {
    return { kind: "not", item: compileFilter(filter.not) };
  }

  if ("rel" in filter) {
    return compileRelation(filter.rel);
  }

  if ("pred" in filter) {
    throw new Error(`Named predicate "${filter.pred}" must be expanded before compile.`);
  }

  if (filter.field === "q") {
    return { kind: "match", value: filter.value };
  }

  return {
    kind: "field",
    field: filter.field,
    op: filter.op,
    value: filter.value
  };
}

function compileRelation(rel: RelationFilter): CompiledPredicate {
  const parts: CompiledPredicate[] = [];

  if (rel.some) {
    parts.push({
      kind: "rel",
      direction: rel.direction,
      types: rel.types,
      quantifier: "some",
      relatedWhere: compileFilter(rel.some)
    });
  }

  if (rel.every) {
    parts.push({
      kind: "rel",
      direction: rel.direction,
      types: rel.types,
      quantifier: "every",
      relatedWhere: compileFilter(rel.every)
    });
  }

  if (rel.none !== undefined) {
    parts.push({
      kind: "rel",
      direction: rel.direction,
      types: rel.types,
      quantifier: "none",
      relatedWhere: rel.none === true ? undefined : compileFilter(rel.none)
    });
  }

  if (parts.length === 0) {
    parts.push({
      kind: "rel",
      direction: rel.direction,
      types: rel.types,
      quantifier: "some"
    });
  }

  if (parts.length === 1) {
    return parts[0]!;
  }
  return { kind: "and", items: parts };
}

function combineWhere(parts: EntityFilter[]): EntityFilter | undefined {
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { and: parts };
}

const DEFAULT_ORDER: EntityOrderBy[] = [{ field: "sortOrder", dir: "asc" }];

/** Expanded filter that will be compiled (type constraint + where). */
export function resolveAppliedFilter(
  query: EntityListQuery = {},
  options?: { type?: EntityType }
): EntityFilter | null {
  const whereParts: EntityFilter[] = [];
  if (options?.type) {
    whereParts.push({ field: "type", op: "eq", value: options.type });
  }
  if (query.where) {
    whereParts.push(expandNamedPredicates(query.where));
  }
  return combineWhere(whereParts) ?? null;
}

export function compileListQuery(
  query: EntityListQuery = {},
  options?: { type?: EntityType }
): QueryPlan {
  const applied = resolveAppliedFilter(query, options);
  return {
    projectKey: query.projectKey ?? "PLAN",
    where: applied ? compileFilter(applied) : { kind: "true" },
    applied,
    orderBy: query.orderBy?.length ? query.orderBy : DEFAULT_ORDER,
    limit: query.limit,
    offset: query.offset,
    select: query.select ?? "compact"
  };
}

export { compileFilter as compileExpandedFilter };

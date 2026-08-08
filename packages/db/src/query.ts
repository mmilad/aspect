import type {
  CompiledPredicate,
  EntityOrderBy,
  EntityStore,
  QueryPlan
} from "@projectplaner/core";
import type { Entity } from "@projectplaner/core";
import type { DatabaseSync } from "node:sqlite";
import { getEntity } from "./repository";

type SqlValue = string | number | null;
type SqlFragment = { sql: string; values: SqlValue[] };

type EntityRow = {
  id: string;
  project_id: string;
  type: string;
  key: string | null;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  sort_order: number;
  metadata_json: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapEntityRow(row: EntityRow): Entity {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as Entity["type"],
    key: row.key,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    status: row.status as Entity["status"],
    sortOrder: row.sort_order,
    metadata: parseJson(row.metadata_json, {})
  };
}

function asList(value: unknown): SqlValue[] {
  if (Array.isArray(value)) {
    return value.map((item) => (item === null || item === undefined ? null : String(item)));
  }
  if (value === null || value === undefined) {
    return [null];
  }
  if (typeof value === "boolean") {
    return [value ? 1 : 0];
  }
  if (typeof value === "number") {
    return [value];
  }
  return [String(value)];
}

function columnForField(alias: string, field: string): string {
  switch (field) {
    case "id":
      return `${alias}.id`;
    case "type":
      return `${alias}.type`;
    case "status":
      return `${alias}.status`;
    case "key":
      return `${alias}.key`;
    case "slug":
      return `${alias}.slug`;
    case "title":
      return `${alias}.title`;
    case "metadata.priority":
      return `json_extract(${alias}.metadata_json, '$.priority')`;
    case "metadata.disabled":
      return `json_extract(${alias}.metadata_json, '$.disabled')`;
    default:
      throw new Error(`Unsupported field in SQL compiler: ${field}`);
  }
}

function compileField(
  alias: string,
  predicate: Extract<CompiledPredicate, { kind: "field" }>
): SqlFragment {
  const column = columnForField(alias, predicate.field);

  if (predicate.field === "metadata.disabled") {
    // COALESCE so missing disabled is false — avoid NULL polluting OR/NOT (SQL 3-valued logic).
    const truthy = `COALESCE(json_extract(${alias}.metadata_json, '$.disabled'), 0) IN (1, 'true')`;
    if (predicate.op === "eq") {
      return { sql: predicate.value ? truthy : `NOT (${truthy})`, values: [] };
    }
    if (predicate.op === "neq") {
      return { sql: predicate.value ? `NOT (${truthy})` : truthy, values: [] };
    }
  }

  if (predicate.op === "eq") {
    return { sql: `${column} = ?`, values: asList(predicate.value).slice(0, 1) };
  }
  if (predicate.op === "neq") {
    return { sql: `${column} <> ?`, values: asList(predicate.value).slice(0, 1) };
  }

  const values = asList(predicate.value);
  if (values.length === 0) {
    return { sql: "0", values: [] };
  }
  const placeholders = values.map(() => "?").join(", ");
  return { sql: `${column} IN (${placeholders})`, values };
}

function compileMatch(alias: string, value: string): SqlFragment {
  const pattern = `%${value}%`;
  return {
    sql: `(${alias}.title LIKE ? OR ${alias}.slug LIKE ? OR ${alias}.summary LIKE ? OR ${alias}.body LIKE ?)`,
    values: [pattern, pattern, pattern, pattern]
  };
}

let aliasCounter = 0;

function nextAlias(prefix: string): string {
  aliasCounter += 1;
  return `${prefix}${aliasCounter}`;
}

function compileRel(
  entityAlias: string,
  predicate: Extract<CompiledPredicate, { kind: "rel" }>
): SqlFragment {
  const typeValues: SqlValue[] = predicate.types ? [...predicate.types] : [];
  const typePlaceholders =
    predicate.types && predicate.types.length > 0 ? predicate.types.map(() => "?").join(", ") : "";

  const relatedFragTemplate = predicate.relatedWhere;

  const buildExists = (direction: "out" | "in", negateRelated: boolean): SqlFragment => {
    const relAlias = nextAlias("r");
    const relatedAlias = nextAlias("related");
    const relatedFrag = relatedFragTemplate
      ? compilePredicate(relatedFragTemplate, relatedAlias)
      : { sql: "1", values: [] as SqlValue[] };
    const relatedSql = negateRelated ? `NOT (${relatedFrag.sql})` : relatedFrag.sql;
    const typeClause = typePlaceholders ? `AND ${relAlias}.type IN (${typePlaceholders})` : "";
    const joinOn =
      direction === "out"
        ? `${relatedAlias}.id = ${relAlias}.target_entity_id`
        : `${relatedAlias}.id = ${relAlias}.source_entity_id`;
    const whereEdge =
      direction === "out"
        ? `${relAlias}.source_entity_id = ${entityAlias}.id`
        : `${relAlias}.target_entity_id = ${entityAlias}.id`;

    return {
      sql: `EXISTS (
        SELECT 1 FROM entity_relations_v2 ${relAlias}
        INNER JOIN entities ${relatedAlias} ON ${joinOn}
        WHERE ${whereEdge}
          AND ${relAlias}.project_id = ${entityAlias}.project_id
          ${typeClause}
          AND (${relatedSql})
      )`,
      values: [...typeValues, ...relatedFrag.values]
    };
  };

  const buildForDirection = (direction: "out" | "in"): SqlFragment => {
    if (predicate.quantifier === "some") {
      return buildExists(direction, false);
    }
    if (predicate.quantifier === "none") {
      const inner = buildExists(direction, false);
      return { sql: `NOT (${inner.sql})`, values: inner.values };
    }
    const inner = buildExists(direction, true);
    return { sql: `NOT (${inner.sql})`, values: inner.values };
  };

  if (predicate.direction === "either") {
    const outFrag = buildForDirection("out");
    const inFrag = buildForDirection("in");
    if (predicate.quantifier === "some") {
      return { sql: `((${outFrag.sql}) OR (${inFrag.sql}))`, values: [...outFrag.values, ...inFrag.values] };
    }
    return { sql: `((${outFrag.sql}) AND (${inFrag.sql}))`, values: [...outFrag.values, ...inFrag.values] };
  }

  return buildForDirection(predicate.direction);
}

export function compilePredicate(predicate: CompiledPredicate, entityAlias = "entities"): SqlFragment {
  switch (predicate.kind) {
    case "true":
      return { sql: "1", values: [] };
    case "field":
      return compileField(entityAlias, predicate);
    case "match":
      return compileMatch(entityAlias, predicate.value);
    case "and": {
      if (predicate.items.length === 0) {
        return { sql: "1", values: [] };
      }
      const parts = predicate.items.map((item) => compilePredicate(item, entityAlias));
      return {
        sql: parts.map((part) => `(${part.sql})`).join(" AND "),
        values: parts.flatMap((part) => part.values)
      };
    }
    case "or": {
      if (predicate.items.length === 0) {
        return { sql: "1", values: [] };
      }
      const parts = predicate.items.map((item) => compilePredicate(item, entityAlias));
      return {
        sql: parts.map((part) => `(${part.sql})`).join(" OR "),
        values: parts.flatMap((part) => part.values)
      };
    }
    case "not": {
      const inner = compilePredicate(predicate.item, entityAlias);
      return { sql: `NOT (${inner.sql})`, values: inner.values };
    }
    case "rel":
      return compileRel(entityAlias, predicate);
    default: {
      const _exhaustive: never = predicate;
      return _exhaustive;
    }
  }
}

function orderClause(orderBy: EntityOrderBy[]): string {
  if (orderBy.length === 0) {
    return "entities.sort_order ASC";
  }
  return orderBy
    .map((order) => {
      const column =
        order.field === "sortOrder"
          ? "entities.sort_order"
          : order.field === "title"
            ? "entities.title"
            : "entities.status";
      return `${column} ${order.dir === "desc" ? "DESC" : "ASC"}`;
    })
    .join(", ");
}

export async function executePlan(db: DatabaseSync, plan: QueryPlan): Promise<Entity[]> {
  aliasCounter = 0;
  const whereFrag = compilePredicate(plan.where, "entities");
  const values: SqlValue[] = [plan.projectKey, ...whereFrag.values];

  let sql = `
    SELECT entities.*
    FROM entities
    INNER JOIN projects ON projects.id = entities.project_id
    WHERE projects.key = ?
      AND (${whereFrag.sql})
    ORDER BY ${orderClause(plan.orderBy)}
  `;

  if (typeof plan.limit === "number") {
    sql += " LIMIT ?";
    values.push(plan.limit);
  }
  if (typeof plan.offset === "number" && plan.offset > 0) {
    if (typeof plan.limit !== "number") {
      sql += " LIMIT -1";
    }
    sql += " OFFSET ?";
    values.push(plan.offset);
  }

  const rows = db.prepare(sql).all(...values) as EntityRow[];
  return rows.map(mapEntityRow);
}

export function createSqliteEntityStore(db: DatabaseSync): EntityStore {
  return {
    getById(id: string) {
      return getEntity(db, id);
    },
    execute(plan: QueryPlan) {
      return executePlan(db, plan);
    }
  };
}

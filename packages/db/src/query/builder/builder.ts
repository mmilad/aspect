import type { SelectQuery, SqlFragment, SqlValue } from "./types";

export function compileSelect(query: SelectQuery): SqlFragment {
  const values: SqlValue[] = [];
  const parts = [
    `SELECT ${query.select}`,
    `FROM ${query.from}`,
    ...(query.joins ?? [])
  ];

  if (query.where?.length) {
    const whereSql = query.where.map((part) => {
      values.push(...part.values);
      return `(${part.sql})`;
    }).join(" AND ");
    parts.push(`WHERE ${whereSql}`);
  }

  if (query.orderBy?.length) {
    parts.push(`ORDER BY ${query.orderBy.join(", ")}`);
  }

  if (typeof query.limit === "number") {
    parts.push("LIMIT ?");
    values.push(query.limit);
  }

  if (typeof query.offset === "number" && query.offset > 0) {
    if (typeof query.limit !== "number") {
      parts.push("LIMIT -1");
    }
    parts.push("OFFSET ?");
    values.push(query.offset);
  }

  return { sql: parts.join("\n"), values };
}

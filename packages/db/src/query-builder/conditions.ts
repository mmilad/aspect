import type { SqlFragment, SqlValue } from "./types";

export function raw(sql: string, values: SqlValue[] = []): SqlFragment {
  return { sql, values };
}

export function eq(column: string, value: SqlValue): SqlFragment {
  return { sql: `${column} = ?`, values: [value] };
}

export function neq(column: string, value: SqlValue): SqlFragment {
  return { sql: `${column} <> ?`, values: [value] };
}

export function and(parts: SqlFragment[]): SqlFragment {
  if (parts.length === 0) {
    return { sql: "1", values: [] };
  }
  return {
    sql: parts.map((part) => `(${part.sql})`).join(" AND "),
    values: parts.flatMap((part) => part.values)
  };
}

export type SqlValue = string | number | null;

export type SqlFragment = {
  sql: string;
  values: SqlValue[];
};

export type OrderDirection = "asc" | "desc";

export type SelectQuery = {
  select: string;
  from: string;
  joins?: string[];
  where?: SqlFragment[];
  orderBy?: string[];
  limit?: number;
  offset?: number;
};

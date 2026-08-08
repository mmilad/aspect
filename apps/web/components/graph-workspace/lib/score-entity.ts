import type { GraphEntity } from "../types";

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export function scoreEntity(entity: GraphEntity, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }
  const joined = [
    entity.id,
    entity.key,
    entity.type,
    entity.title,
    entity.summary,
    entity.body,
    entity.path,
    JSON.stringify(entity.metadata)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let score = joined.includes(normalized) ? 100 : 0;
  for (const token of queryTokens(query)) {
    if (joined.includes(token)) {
      score += 10;
    }
  }
  return score;
}

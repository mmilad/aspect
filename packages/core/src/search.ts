import type { Entity } from "./types";

export interface RankedResult<T> {
  item: T;
  score: number;
}

export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export function scoreSearch(values: Array<string | null | undefined>, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 0;
  }

  const joined = values.filter(Boolean).join(" ").toLowerCase();
  if (!joined) {
    return 0;
  }

  let score = joined.includes(normalized) ? 100 : 0;
  for (const token of queryTokens(query)) {
    if (joined.includes(token)) {
      score += 10;
    }
  }
  return score;
}

export function rankedByQuery<T>(
  items: T[],
  query: string,
  valuesForItem: (item: T) => Array<string | null | undefined>
): Array<RankedResult<T>> {
  return items
    .map((item) => ({ item, score: scoreSearch(valuesForItem(item), query) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function entitySearchValues(entity: Entity): Array<string | null | undefined> {
  return [
    entity.id,
    entity.type,
    entity.key,
    entity.slug,
    entity.title,
    entity.summary,
    entity.body,
    entity.status,
    JSON.stringify(entity.metadata)
  ];
}

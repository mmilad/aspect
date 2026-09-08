import type { JsonRecord } from "@projectplaner/core";

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function compactJson(value: JsonRecord): string {
  return JSON.stringify(value);
}

export function compactUnknownJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

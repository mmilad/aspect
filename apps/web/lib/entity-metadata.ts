import type { JsonRecord } from "@projectplaner/core";

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function readMetadataString(metadata: JsonRecord, key: string): string | null {
  return readString(metadata[key]);
}

export function readMetadataStringList(metadata: JsonRecord, key: string): string[] {
  return readStringList(metadata[key]);
}

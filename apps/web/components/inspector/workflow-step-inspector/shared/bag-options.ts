import type { BagShape } from "@projectplaner/core";

export function bagKeyOptions(view: Record<string, BagShape>): string[] {
  return Object.keys(view).sort();
}

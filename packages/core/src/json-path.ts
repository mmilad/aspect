/** Dotted-path get/set on plain records (workflow node data, assistant session, …). */

export function getDataPath(data: unknown, path: string): unknown {
  if (!path) {
    return undefined;
  }
  const parts = path.split(".").filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Immutable set; creates intermediate objects. */
export function setDataPath<T extends Record<string, unknown>>(data: T, path: string, value: unknown): T {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) {
    return data;
  }
  const root: Record<string, unknown> = { ...data };
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cursor[key];
    const clone =
      typeof next === "object" && next !== null && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : {};
    cursor[key] = clone;
    cursor = clone;
  }
  cursor[parts[parts.length - 1]!] = value;
  return root as T;
}

export function pathIsNonempty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

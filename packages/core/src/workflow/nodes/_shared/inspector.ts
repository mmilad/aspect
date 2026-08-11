import type { WorkflowNodeData } from "./types";

/** Declarative inspector field — rendered by the web WorkflowStepInspector. */
export type WorkflowInspectorField =
  | {
      kind: "text" | "textarea" | "number";
      label: string;
      /** Dot path under node.data (e.g. llm.instructions). */
      path: string;
      placeholder?: string;
    }
  | {
      kind: "select";
      label: string;
      path: string;
      options: Array<{ value: string; label: string }>;
    }
  | {
      kind: "bagKey";
      label: string;
      path: string;
    }
  | {
      /** Shared timeout / idempotency / onExhausted block for tool|llm|write. */
      kind: "executionPolicy";
    }
  | {
      /** Map field list editor. */
      kind: "mapFields";
    }
  | {
      /** Tool argsFromBag first-mapping picker. */
      kind: "toolArgs";
    };

export function getDataPath(data: WorkflowNodeData, path: string): unknown {
  if (!path) {
    return undefined;
  }
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Immutable set of a dotted path on node data (creates intermediate objects). */
export function setDataPath(data: WorkflowNodeData, path: string, value: unknown): WorkflowNodeData {
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
  return root as WorkflowNodeData;
}

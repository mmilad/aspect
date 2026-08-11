import { isRecord } from "../_shared/schema";
import type { WorkflowMapConfig, WorkflowNodeData } from "../_shared/types";

export function parseMapConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowMapConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} map config must be an object.`);
    return undefined;
  }
  if (typeof raw.from !== "string" || !raw.from.trim()) {
    errors.push(`Node ${nodeId} map.from is required.`);
    return undefined;
  }
  if (typeof raw.as !== "string" || !raw.as.trim()) {
    errors.push(`Node ${nodeId} map.as is required.`);
    return undefined;
  }
  if (!Array.isArray(raw.fields) || raw.fields.length === 0) {
    errors.push(`Node ${nodeId} map.fields must be a non-empty array.`);
    return undefined;
  }
  const fields: WorkflowMapConfig["fields"] = [];
  for (const item of raw.fields) {
    if (!isRecord(item) || typeof item.from !== "string" || typeof item.as !== "string") {
      errors.push(`Node ${nodeId} map.fields entries require from and as strings.`);
      continue;
    }
    fields.push({ from: item.from, as: item.as });
  }
  if (fields.length === 0) {
    return undefined;
  }
  return {
    from: raw.from,
    as: raw.as,
    mode: raw.mode === "array" || raw.mode === "object" ? raw.mode : undefined,
    fields
  };
}

export function parseMapNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const map = parseMapConfig(raw.map, nodeId, errors);
  return map ? { map } : {};
}

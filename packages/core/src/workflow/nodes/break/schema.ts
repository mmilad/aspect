import { isRecord } from "../_shared/schema";
import type { WorkflowBreakConfig, WorkflowNodeData } from "../_shared/types";

export function parseBreakConfig(raw: unknown, nodeId: string, errors: string[]): WorkflowBreakConfig | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} break config must be an object.`);
    return undefined;
  }
  if (typeof raw.from !== "string" || !raw.from.trim()) {
    errors.push(`Node ${nodeId} break.from is required.`);
    return undefined;
  }
  let fields: Record<string, string> | undefined;
  if (raw.fields !== undefined) {
    if (!isRecord(raw.fields)) {
      errors.push(`Node ${nodeId} break.fields must be an object.`);
    } else {
      fields = {};
      for (const [source, target] of Object.entries(raw.fields)) {
        if (typeof target !== "string" || !target.trim()) {
          errors.push(`Node ${nodeId} break.fields.${source} must be a non-empty string.`);
        } else fields[source] = target;
      }
    }
  }
  return { from: raw.from, ...(fields ? { fields } : {}) };
}

export function parseBreakNodeConfig(raw: Record<string, unknown>, nodeId: string, errors: string[]): Partial<WorkflowNodeData> {
  const config = parseBreakConfig(raw.break, nodeId, errors);
  return config ? { break: config } : {};
}

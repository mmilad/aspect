import { isRecord } from "../_shared/schema";
import type { WorkflowDelegateConfig, WorkflowNodeData } from "../_shared/types";

export function parseDelegateConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowDelegateConfig | undefined {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} delegate config must be an object.`);
    return undefined;
  }
  const config: WorkflowDelegateConfig = {};
  for (const field of ["agentIdFrom", "taskFrom", "runIdFrom", "messageFrom"] as const) {
    if (raw[field] !== undefined && typeof raw[field] !== "string") {
      errors.push(`Node ${nodeId} delegate.${field} must be a string.`);
    } else if (typeof raw[field] === "string" && raw[field].trim()) {
      config[field] = raw[field].trim();
    }
  }
  return config;
}

export function parseDelegateNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const delegate = parseDelegateConfig(raw.delegate, nodeId, errors);
  return delegate ? { delegate } : {};
}

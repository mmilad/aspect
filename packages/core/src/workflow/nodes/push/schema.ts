import { isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowPushConfig } from "../_shared/types";

export function parsePushConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowPushConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} push config must be an object.`);
    return undefined;
  }
  if (typeof raw.target !== "string" || !raw.target.trim()) {
    errors.push(`Node ${nodeId} push.target is required.`);
  }
  if (typeof raw.valueFrom !== "string" || !raw.valueFrom.trim()) {
    errors.push(`Node ${nodeId} push.valueFrom is required.`);
  }
  if (typeof raw.target !== "string" || typeof raw.valueFrom !== "string") {
    return undefined;
  }
  return {
    target: raw.target,
    valueFrom: raw.valueFrom
  };
}

export function parsePushNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const push = parsePushConfig(raw.push, nodeId, errors);
  return push ? { push } : {};
}

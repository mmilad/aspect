import { isRecord } from "../_shared/schema";
import type { WorkflowAutoConfig, WorkflowNodeData } from "../_shared/types";

export function parseAutoConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowAutoConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} auto config must be an object.`);
    return undefined;
  }
  return raw as unknown as WorkflowAutoConfig;
}

export function parseContextNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const auto = parseAutoConfig(raw.auto, nodeId, errors);
  return auto ? { auto } : {};
}

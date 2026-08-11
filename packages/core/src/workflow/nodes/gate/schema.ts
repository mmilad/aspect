import { isRecord } from "../_shared/schema";
import type { WorkflowGateConfig, WorkflowNodeData } from "../_shared/types";

export function parseGateConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowGateConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} gate config must be an object.`);
    return undefined;
  }
  return raw as unknown as WorkflowGateConfig;
}

export function parseGateNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const gate = parseGateConfig(raw.gate, nodeId, errors);
  return gate ? { gate } : {};
}

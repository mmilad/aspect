import { isRecord } from "../_shared/schema";
import type { WorkflowBranchConfig, WorkflowNodeData } from "../_shared/types";

export function parseBranchConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowBranchConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} branch config must be an object.`);
    return undefined;
  }
  return {
    on: typeof raw.on === "string" ? raw.on : undefined
  };
}

export function parseBranchNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const branch = parseBranchConfig(raw.branch, nodeId, errors);
  return branch ? { branch } : {};
}

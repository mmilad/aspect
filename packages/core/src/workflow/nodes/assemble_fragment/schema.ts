import { isRecord } from "../_shared/schema";
import type { WorkflowAssembleFragmentConfig, WorkflowNodeData } from "../_shared/types";

export function parseAssembleFragmentConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowAssembleFragmentConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} assembleFragment config must be an object.`);
    return undefined;
  }
  if (typeof raw.draftsFrom !== "string" || !raw.draftsFrom.trim()) {
    errors.push(`Node ${nodeId} assembleFragment.draftsFrom is required.`);
    return undefined;
  }
  return {
    draftsFrom: raw.draftsFrom,
    outputKey: typeof raw.outputKey === "string" ? raw.outputKey : undefined
  };
}

export function parseAssembleFragmentNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const assembleFragment = parseAssembleFragmentConfig(raw.assembleFragment, nodeId, errors);
  return assembleFragment ? { assembleFragment } : {};
}

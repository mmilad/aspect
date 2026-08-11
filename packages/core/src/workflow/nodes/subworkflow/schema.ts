import { asStringMap, isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowSubworkflowConfig } from "../_shared/types";

export function parseSubworkflowConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowSubworkflowConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw) || typeof raw.workflowId !== "string" || !raw.workflowId.trim()) {
    errors.push(`Node ${nodeId} subworkflow.workflowId is required.`);
    return undefined;
  }
  return {
    workflowId: raw.workflowId,
    inputMap: asStringMap(raw.inputMap),
    outputMap: asStringMap(raw.outputMap)
  };
}

export function parseSubworkflowNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const subworkflow = parseSubworkflowConfig(raw.subworkflow, nodeId, errors);
  return subworkflow ? { subworkflow } : {};
}

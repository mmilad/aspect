import { isRecord } from "../_shared/schema";
import type { WorkflowCreateWorkflowNodeConfig, WorkflowNodeData } from "../_shared/types";

export function parseCreateWorkflowNodeConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowCreateWorkflowNodeConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} createWorkflowNode config must be an object.`);
    return undefined;
  }
  if (typeof raw.planFrom !== "string" || !raw.planFrom.trim()) {
    errors.push(`Node ${nodeId} createWorkflowNode.planFrom is required.`);
  }
  for (const key of [
    "outputKey",
    "metaKey",
    "errorsKey",
    "hasErrorsKey",
    "repairInstructionsKey",
    "stepDraftKey"
  ]) {
    const value = raw[key];
    if (value !== undefined && typeof value !== "string") {
      errors.push(`Node ${nodeId} createWorkflowNode.${key} must be a string.`);
    }
  }
  if (typeof raw.planFrom !== "string") {
    return undefined;
  }
  return {
    planFrom: raw.planFrom,
    outputKey: typeof raw.outputKey === "string" ? raw.outputKey : undefined,
    metaKey: typeof raw.metaKey === "string" ? raw.metaKey : undefined,
    errorsKey: typeof raw.errorsKey === "string" ? raw.errorsKey : undefined,
    hasErrorsKey: typeof raw.hasErrorsKey === "string" ? raw.hasErrorsKey : undefined,
    repairInstructionsKey:
      typeof raw.repairInstructionsKey === "string" ? raw.repairInstructionsKey : undefined,
    stepDraftKey: typeof raw.stepDraftKey === "string" ? raw.stepDraftKey : undefined
  };
}

export function parseCreateWorkflowNodeNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const createWorkflowNode = parseCreateWorkflowNodeConfig(
    raw.createWorkflowNode,
    nodeId,
    errors
  );
  return createWorkflowNode ? { createWorkflowNode } : {};
}

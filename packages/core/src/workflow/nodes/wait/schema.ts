import { isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowWaitConfig } from "../_shared/types";

export function parseWaitConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowWaitConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} wait config must be an object.`);
    return undefined;
  }
  const wait: WorkflowWaitConfig = {
    delayMs: typeof raw.delayMs === "number" ? raw.delayMs : undefined,
    until: typeof raw.until === "string" ? raw.until : undefined
  };
  if (wait.delayMs === undefined && !wait.until) {
    errors.push(`Node ${nodeId} wait requires delayMs or until.`);
  }
  return wait;
}

export function parseWaitNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const wait = parseWaitConfig(raw.wait, nodeId, errors);
  return wait ? { wait } : {};
}

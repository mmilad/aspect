import { isRecord } from "../_shared/schema";
import type { WorkflowFileReadConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

export function parseFileReadNodeConfig(raw: Record<string, unknown>, nodeId: string, errors: string[]): Partial<WorkflowNodeData> {
  if (raw.fileRead === undefined) return { fileRead: {} };
  if (!isRecord(raw.fileRead)) {
    errors.push(`Node ${nodeId} fileRead config must be an object.`);
    return {};
  }
  const fileRead: WorkflowFileReadConfig = {
    pathFrom: optionalString(raw.fileRead, "pathFrom"),
    maxBytesFrom: optionalString(raw.fileRead, "maxBytesFrom")
  };
  return { fileRead };
}

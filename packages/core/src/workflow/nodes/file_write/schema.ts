import { isRecord } from "../_shared/schema";
import type { WorkflowFileWriteConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

export function parseFileWriteNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  if (raw.fileWrite === undefined) return { fileWrite: {} };
  if (!isRecord(raw.fileWrite)) {
    errors.push(`Node ${nodeId} fileWrite config must be an object.`);
    return {};
  }
  const fileWrite: WorkflowFileWriteConfig = {
    pathFrom: optionalString(raw.fileWrite, "pathFrom"),
    contentFrom: optionalString(raw.fileWrite, "contentFrom"),
    overwriteFrom: optionalString(raw.fileWrite, "overwriteFrom")
  };
  return { fileWrite };
}

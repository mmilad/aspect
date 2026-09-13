import { isRecord } from "../_shared/schema";
import type { WorkflowFileListConfig, WorkflowNodeData } from "../_shared/types";

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  return typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim() : undefined;
}

export function parseFileListNodeConfig(raw: Record<string, unknown>, nodeId: string, errors: string[]): Partial<WorkflowNodeData> {
  if (raw.fileList === undefined) return { fileList: {} };
  if (!isRecord(raw.fileList)) {
    errors.push(`Node ${nodeId} fileList config must be an object.`);
    return {};
  }
  const fileList: WorkflowFileListConfig = {
    pathFrom: optionalString(raw.fileList, "pathFrom"),
    recursiveFrom: optionalString(raw.fileList, "recursiveFrom"),
    maxEntriesFrom: optionalString(raw.fileList, "maxEntriesFrom")
  };
  return { fileList };
}

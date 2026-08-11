import type { JsonRecord } from "../../../domain/types";
import { asStringMap, isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowWriteConfig } from "../_shared/types";

const WRITE_ACTIONS = new Set(["create_entity", "update_entity", "rollup_parent_status"]);

export function parseWriteConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowWriteConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} write config must be an object.`);
    return undefined;
  }
  if (raw.action !== undefined) {
    if (typeof raw.action !== "string" || !WRITE_ACTIONS.has(raw.action)) {
      errors.push(
        `Node ${nodeId} write.action must be create_entity|update_entity|rollup_parent_status.`
      );
      return undefined;
    }
  } else {
    errors.push(
      `Node ${nodeId} write.action must be create_entity|update_entity|rollup_parent_status.`
    );
    return undefined;
  }
  return {
    action: raw.action as WorkflowWriteConfig["action"],
    argsFromBag: asStringMap(raw.argsFromBag),
    defaults: isRecord(raw.defaults) ? (raw.defaults as JsonRecord) : undefined
  };
}

export function parseWriteNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const write = parseWriteConfig(raw.write, nodeId, errors);
  return write ? { write } : {};
}

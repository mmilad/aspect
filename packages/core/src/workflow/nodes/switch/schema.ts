import { asStringArray, isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowSwitchConfig } from "../_shared/types";

export function parseSwitchConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowSwitchConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} switch config must be an object.`);
    return undefined;
  }
  const cases = asStringArray(raw.cases);
  if (raw.cases !== undefined && !cases) {
    errors.push(`Node ${nodeId} switch.cases must be a string array.`);
  }
  return {
    on: typeof raw.on === "string" ? raw.on : undefined,
    cases,
    defaultLabel: typeof raw.defaultLabel === "string" ? raw.defaultLabel : undefined
  };
}

export function parseSwitchNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const sw = parseSwitchConfig(raw.switch, nodeId, errors);
  return sw ? { switch: sw } : {};
}

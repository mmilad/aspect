import { asStringMap, isRecord } from "../_shared/schema";
import type { WorkflowNodeData, WorkflowToolConfig } from "../_shared/types";

export function parseToolConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowToolConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} tool config must be an object.`);
    return undefined;
  }
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    errors.push(`Node ${nodeId} tool.name is required.`);
    return undefined;
  }
  return {
    name: raw.name,
    argsFromBag: asStringMap(raw.argsFromBag)
  };
}

export function parseToolNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const tool = parseToolConfig(raw.tool, nodeId, errors);
  return tool ? { tool } : {};
}

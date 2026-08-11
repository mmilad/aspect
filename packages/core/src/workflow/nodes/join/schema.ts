import { asStringArray, isRecord } from "../_shared/schema";
import type { WorkflowJoinConfig, WorkflowNodeData } from "../_shared/types";

export function parseJoinConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowJoinConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} join config must be an object.`);
    return undefined;
  }
  const join: WorkflowJoinConfig = {};
  if (raw.mode === "all" || raw.mode === "any") {
    join.mode = raw.mode;
  } else if (isRecord(raw.mode) && typeof raw.mode.count === "number" && Number.isInteger(raw.mode.count)) {
    join.mode = { count: raw.mode.count };
  } else if (raw.mode !== undefined) {
    errors.push(`Node ${nodeId} join.mode must be all|any|{count}.`);
  }
  if (raw.remaining === "cancel_remaining" || raw.remaining === "ignore_remaining") {
    join.remaining = raw.remaining;
  } else if (raw.remaining !== undefined) {
    errors.push(`Node ${nodeId} join.remaining must be cancel_remaining|ignore_remaining.`);
  }
  if (raw.merge !== undefined) {
    if (!isRecord(raw.merge)) {
      errors.push(`Node ${nodeId} join.merge must be an object.`);
    } else {
      const strategy = raw.merge.strategy;
      if (
        strategy !== undefined &&
        strategy !== "object_per_arm" &&
        strategy !== "prefer_first" &&
        strategy !== "prefer_last" &&
        strategy !== "fail_on_conflict"
      ) {
        errors.push(`Node ${nodeId} join.merge.strategy is invalid.`);
      } else {
        join.merge = {
          strategy,
          as: typeof raw.merge.as === "string" ? raw.merge.as : undefined,
          keys: asStringArray(raw.merge.keys)
        };
      }
    }
  }
  return join;
}

export function parseJoinNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const join = parseJoinConfig(raw.join, nodeId, errors);
  return join ? { join } : {};
}

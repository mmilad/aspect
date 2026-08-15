import { isRecord } from "../_shared/schema";
import type { WorkflowMathConfig, WorkflowNodeData } from "../_shared/types";

const OPERATIONS = new Set(["add", "subtract", "multiply", "divide"]);

export function parseMathConfig(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowMathConfig | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} math config must be an object.`);
    return undefined;
  }
  if (typeof raw.operation !== "string" || !OPERATIONS.has(raw.operation)) {
    errors.push(`Node ${nodeId} math.operation must be add|subtract|multiply|divide.`);
  }
  if (typeof raw.operand !== "number" || !Number.isFinite(raw.operand)) {
    errors.push(`Node ${nodeId} math.operand must be a finite number.`);
  }
  if (typeof raw.operation !== "string" || !OPERATIONS.has(raw.operation) || typeof raw.operand !== "number") {
    return undefined;
  }
  return {
    operation: raw.operation as WorkflowMathConfig["operation"],
    operand: raw.operand
  };
}

export function parseMathNodeConfig(
  raw: Record<string, unknown>,
  nodeId: string,
  errors: string[]
): Partial<WorkflowNodeData> {
  const math = parseMathConfig(raw.math, nodeId, errors);
  return math ? { math } : {};
}

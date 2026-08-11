import { parseBagShape } from "../../shapes";
import {
  workflowNodeTypes,
  workflowRetryOnValues,
  type WorkflowBagKeyContract,
  type WorkflowExecutionPolicy,
  type WorkflowNodeData,
  type WorkflowNodeType,
  type WorkflowPosition,
  type WorkflowRetryOn
} from "./types";

const WORKFLOW_NODE_TYPE_SET = new Set<string>(workflowNodeTypes);
const WORKFLOW_RETRY_ON_SET = new Set<string>(workflowRetryOnValues);

/** Type-specific config keys on WorkflowNodeData. */
export const CONFIG_KEYS = [
  "auto",
  "tool",
  "llm",
  "write",
  "gate",
  "branch",
  "switch",
  "join",
  "foreach",
  "map",
  "wait",
  "subworkflow"
] as const;

export type WorkflowConfigKey = (typeof CONFIG_KEYS)[number];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPosition(value: unknown): value is WorkflowPosition {
  return isRecord(value) && typeof value.x === "number" && typeof value.y === "number";
}

export function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return value;
}

export function asStringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      return undefined;
    }
    out[key] = item;
  }
  return out;
}

export function normalizeNodeType(raw: string): WorkflowNodeType | null {
  if (raw === "filter") {
    return "transform";
  }
  if (WORKFLOW_NODE_TYPE_SET.has(raw)) {
    return raw as WorkflowNodeType;
  }
  return null;
}

export function parseExecutionPolicy(
  raw: unknown,
  nodeId: string,
  errors: string[]
): WorkflowExecutionPolicy | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} executionPolicy must be an object.`);
    return undefined;
  }
  const policy: WorkflowExecutionPolicy = {};
  if (raw.timeoutMs !== undefined) {
    if (typeof raw.timeoutMs !== "number" || !Number.isFinite(raw.timeoutMs) || raw.timeoutMs < 0) {
      errors.push(`Node ${nodeId} executionPolicy.timeoutMs must be a non-negative number.`);
    } else {
      policy.timeoutMs = raw.timeoutMs;
    }
  }
  if (raw.onExhausted !== undefined) {
    if (raw.onExhausted !== "error_edge" && raw.onExhausted !== "fail_run") {
      errors.push(`Node ${nodeId} executionPolicy.onExhausted must be error_edge|fail_run.`);
    } else {
      policy.onExhausted = raw.onExhausted;
    }
  }
  if (typeof raw.idempotencyKeyFrom === "string") {
    policy.idempotencyKeyFrom = raw.idempotencyKeyFrom;
  }
  if (raw.sideEffect !== undefined) {
    if (raw.sideEffect !== "unknown" && raw.sideEffect !== "idempotent" && raw.sideEffect !== "non_idempotent") {
      errors.push(`Node ${nodeId} executionPolicy.sideEffect is invalid.`);
    } else {
      policy.sideEffect = raw.sideEffect;
    }
  }
  if (raw.retry !== undefined) {
    if (!isRecord(raw.retry)) {
      errors.push(`Node ${nodeId} executionPolicy.retry must be an object.`);
    } else {
      const maxAttempts = raw.retry.maxAttempts;
      if (typeof maxAttempts !== "number" || !Number.isInteger(maxAttempts) || maxAttempts < 1) {
        errors.push(`Node ${nodeId} executionPolicy.retry.maxAttempts must be a positive integer.`);
      } else {
        policy.retry = {
          maxAttempts,
          backoffMs: typeof raw.retry.backoffMs === "number" ? raw.retry.backoffMs : undefined,
          backoff: raw.retry.backoff === "fixed" || raw.retry.backoff === "exponential" ? raw.retry.backoff : undefined,
          retryOn: Array.isArray(raw.retry.retryOn)
            ? (raw.retry.retryOn.filter(
                (item): item is WorkflowRetryOn => typeof item === "string" && WORKFLOW_RETRY_ON_SET.has(item)
              ) as WorkflowRetryOn[])
            : undefined
        };
      }
    }
  }
  return policy;
}

export function parseBagKeyContracts(
  raw: unknown,
  nodeId: string,
  field: string,
  errors: string[]
): Record<string, WorkflowBagKeyContract> | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} data.${field} must be an object.`);
    return undefined;
  }
  const out: Record<string, WorkflowBagKeyContract> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      errors.push(`Node ${nodeId} data.${field}.${key} must be an object.`);
      continue;
    }
    const shape = value.shape !== undefined ? parseBagShape(value.shape) : undefined;
    if (value.shape !== undefined && !shape) {
      errors.push(`Node ${nodeId} data.${field}.${key}.shape is invalid.`);
    }
    out[key] = {
      required: typeof value.required === "boolean" ? value.required : undefined,
      shape
    };
  }
  return out;
}

export type ParsedBaseNodeData = {
  title: string;
  reads?: string[];
  writes?: string[];
  outputs?: string[];
  inputs?: Record<string, WorkflowBagKeyContract>;
  outputContracts?: Record<string, WorkflowBagKeyContract>;
  inputBindings?: Record<string, string>;
  writeBindings?: Record<string, string>;
  executionPolicy?: WorkflowExecutionPolicy;
};

export function parseBaseNodeData(
  raw: unknown,
  nodeId: string,
  errors: string[]
): ParsedBaseNodeData | null {
  if (!isRecord(raw)) {
    errors.push(`Node ${nodeId} data must be an object.`);
    return null;
  }
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    errors.push(`Node ${nodeId} requires data.title.`);
    return null;
  }

  const reads = asStringArray(raw.reads);
  if (raw.reads !== undefined && !reads) {
    errors.push(`Node ${nodeId} data.reads must be string[].`);
  }
  const writes = asStringArray(raw.writes);
  if (raw.writes !== undefined && !writes) {
    errors.push(`Node ${nodeId} data.writes must be string[].`);
  }
  const outputs = asStringArray(raw.outputs);
  if (raw.outputs !== undefined && !outputs) {
    errors.push(`Node ${nodeId} data.outputs must be string[].`);
  }

  return {
    title: raw.title,
    reads,
    writes,
    outputs,
    inputs: parseBagKeyContracts(raw.inputs, nodeId, "inputs", errors),
    outputContracts: parseBagKeyContracts(raw.outputContracts, nodeId, "outputContracts", errors),
    inputBindings: asStringMap(raw.inputBindings),
    writeBindings: asStringMap(raw.writeBindings),
    executionPolicy: parseExecutionPolicy(raw.executionPolicy, nodeId, errors)
  };
}

/** Ensure only base fields + the allowed config key remain on node data. */
export function pickNodeData(
  base: ParsedBaseNodeData,
  configPartial: Partial<WorkflowNodeData>,
  configKey?: keyof WorkflowNodeData
): WorkflowNodeData {
  const data: WorkflowNodeData = {
    title: base.title,
    reads: base.reads,
    writes: base.writes,
    outputs: base.outputs,
    inputs: base.inputs,
    outputContracts: base.outputContracts,
    inputBindings: base.inputBindings,
    writeBindings: base.writeBindings,
    executionPolicy: base.executionPolicy
  };
  if (configKey && configKey in configPartial) {
    (data as Record<string, unknown>)[configKey] = configPartial[configKey];
  } else if (!configKey) {
    Object.assign(data, configPartial);
  }
  return data;
}

import type { WorkflowContextBag } from "./graph/types";
import type { WorkflowBagKeyContract, WorkflowNode, WorkflowNodeType } from "./nodes/_shared/types";
import {
  derivedWrites,
  resolveInputBindings,
  resolveWriteBindings
} from "./ports";
import { validateValueAgainstShape } from "./shapes";

const WORK_NODE_TYPES = new Set<WorkflowNodeType>([
  "tool",
  "llm",
  "write",
  "context",
  "transform",
  "map"
]);

function isRequired(contract: WorkflowBagKeyContract | undefined): boolean {
  return contract?.required !== false;
}

/** Input port ids to validate (from inputs catalog, else legacy reads / route keys). */
export function inputPortKeys(node: WorkflowNode): string[] {
  const fromInputs = Object.keys(node.data.inputs ?? {});
  if (fromInputs.length > 0) {
    return fromInputs;
  }
  const keys = new Set<string>([...(node.data.reads ?? [])]);
  if (node.type === "branch" && node.data.branch?.on) {
    keys.add(node.data.branch.on);
  }
  if (node.type === "switch" && node.data.switch?.on) {
    keys.add(node.data.switch.on);
  }
  return [...keys];
}

export function validateNodeInputs(
  node: WorkflowNode,
  bag: WorkflowContextBag
): { ok: true } | { ok: false; error: string } {
  const inputBindings = resolveInputBindings(node);
  for (const portId of inputPortKeys(node)) {
    const contract = node.data.inputs?.[portId] ?? {
      required: true,
      shape: { kind: "unknown" as const }
    };
    const bagKey = inputBindings[portId] ?? portId;
    const value = bag.keys[bagKey];
    const present = bagKey in bag.keys && value !== undefined;
    if (!present) {
      if (isRequired(contract)) {
        return { ok: false, error: `Missing required input '${portId}' (bag key '${bagKey}')` };
      }
      continue;
    }
    if (!contract.shape) {
      continue;
    }
    const check = validateValueAgainstShape(value, contract.shape);
    if (!check.ok) {
      return {
        ok: false,
        error: `Input '${portId}' (bag '${bagKey}') failed shape check: ${check.error}`
      };
    }
  }
  return { ok: true };
}

/**
 * Validate declared writes after a successful bag mutation (advanced / LLM resume).
 * Validates each write-bound output port against the bag key from writeBindings.
 */
export function validateNodeOutputs(
  node: WorkflowNode,
  bag: WorkflowContextBag
): { ok: true } | { ok: false; error: string } {
  const writeBindings = resolveWriteBindings(node);
  const ports = Object.keys(writeBindings);
  if (ports.length === 0) {
    return { ok: true };
  }

  for (const portId of ports) {
    const contract = node.data.outputContracts?.[portId] ?? {
      required: true,
      shape: { kind: "unknown" as const }
    };
    const bagKey = writeBindings[portId] ?? portId;
    const value = bag.keys[bagKey];
    const present = bagKey in bag.keys && value !== undefined;
    if (!present) {
      if (isRequired(contract) && derivedWrites(node).includes(bagKey)) {
        return { ok: false, error: `Missing required output '${portId}' (bag key '${bagKey}')` };
      }
      continue;
    }
    if (!contract.shape) {
      continue;
    }
    const check = validateValueAgainstShape(value, contract.shape);
    if (!check.ok) {
      return {
        ok: false,
        error: `Output '${portId}' (bag '${bagKey}') failed shape check: ${check.error}`
      };
    }
  }
  return { ok: true };
}

export function shouldStrictValidateInputs(node: WorkflowNode): boolean {
  if (WORK_NODE_TYPES.has(node.type)) {
    return true;
  }
  return inputPortKeys(node).length > 0 && Boolean(node.data.inputs && Object.keys(node.data.inputs).length > 0);
}

export function shouldStrictValidateOutputs(node: WorkflowNode): boolean {
  return WORK_NODE_TYPES.has(node.type);
}

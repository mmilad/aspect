import type { WorkflowContextBag } from "./graph/types";
import type { WorkflowBagKeyContract, WorkflowNode, WorkflowNodeType } from "./nodes/_shared/types";
import { validateValueAgainstShape } from "./shapes";

const WORK_NODE_TYPES = new Set<WorkflowNodeType>([
  "tool",
  "llm",
  "write",
  "context",
  "transform",
  "map"
]);

const DEFAULT_UNKNOWN: WorkflowBagKeyContract = {
  required: true,
  shape: { kind: "unknown" }
};

function getNodeWrites(node: WorkflowNode): string[] {
  return node.data.writes ?? node.data.outputs ?? [];
}

function contractForInput(node: WorkflowNode, key: string): WorkflowBagKeyContract {
  return node.data.inputs?.[key] ?? DEFAULT_UNKNOWN;
}

function contractForOutput(node: WorkflowNode, key: string): WorkflowBagKeyContract | undefined {
  return node.data.outputContracts?.[key];
}

function isRequired(contract: WorkflowBagKeyContract | undefined): boolean {
  return contract?.required !== false;
}

/** Keys to validate as inputs: declared reads plus any explicit input contracts. */
export function inputPortKeys(node: WorkflowNode): string[] {
  const keys = new Set<string>([...(node.data.reads ?? []), ...Object.keys(node.data.inputs ?? {})]);
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
  for (const key of inputPortKeys(node)) {
    const contract = contractForInput(node, key);
    const value = bag.keys[key];
    const present = key in bag.keys && value !== undefined;
    if (!present) {
      if (isRequired(contract)) {
        return { ok: false, error: `Missing required input '${key}'` };
      }
      continue;
    }
    if (!contract.shape) {
      continue;
    }
    const check = validateValueAgainstShape(value, contract.shape);
    if (!check.ok) {
      return { ok: false, error: `Input '${key}' failed shape check: ${check.error}` };
    }
  }
  return { ok: true };
}

/**
 * Validate declared writes after a successful bag mutation (advanced / LLM resume).
 * Only shape-checks keys that have outputContracts (or all writes once any contract exists).
 */
export function validateNodeOutputs(
  node: WorkflowNode,
  bag: WorkflowContextBag
): { ok: true } | { ok: false; error: string } {
  const writes = getNodeWrites(node);
  const contractKeys = new Set(Object.keys(node.data.outputContracts ?? {}));
  const keys = new Set([...writes, ...contractKeys]);

  for (const key of keys) {
    const contract = contractForOutput(node, key);
    if (!contract && !node.data.outputContracts) {
      continue;
    }
    const effective = contract ?? { required: true, shape: { kind: "unknown" as const } };
    const value = bag.keys[key];
    const present = key in bag.keys && value !== undefined;
    if (!present) {
      if (isRequired(effective) && writes.includes(key)) {
        return { ok: false, error: `Missing required output '${key}'` };
      }
      continue;
    }
    if (!effective.shape) {
      continue;
    }
    const check = validateValueAgainstShape(value, effective.shape);
    if (!check.ok) {
      return { ok: false, error: `Output '${key}' failed shape check: ${check.error}` };
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

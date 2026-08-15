import type { WorkflowContextBag, WorkflowGraph } from "./graph/types";
import type { WorkflowBagKeyContract, WorkflowNode, WorkflowNodeType } from "./nodes/_shared/types";
import { pinKey, usesPinFrame } from "./graph/variables";
import { resolveDataInput } from "./graph/frame";
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
  "map",
  "math",
  "push",
  "create_workflow_node"
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
  bag: WorkflowContextBag,
  graph?: WorkflowGraph
): { ok: true } | { ok: false; error: string } {
  const pinGraph = graph && usesPinFrame(graph);
  const inputBindings = pinGraph ? {} : resolveInputBindings(node);
  for (const portId of inputPortKeys(node)) {
    const contract = node.data.inputs?.[portId] ?? {
      required: true,
      shape: { kind: "unknown" as const }
    };
    const value = pinGraph
      ? resolveDataInput(graph, bag, node, portId)
      : bag.keys[inputBindings[portId] ?? portId];
    const bagKey = pinGraph ? portId : (inputBindings[portId] ?? portId);
    const present = pinGraph
      ? value !== undefined
      : bagKey in bag.keys && value !== undefined;
    if (!present) {
      if (isRequired(contract)) {
        return {
          ok: false,
          error: pinGraph
            ? `Missing required input '${portId}'`
            : `Missing required input '${portId}' (bag key '${bagKey}')`
        };
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
        error: pinGraph
          ? `Input '${portId}' failed shape check: ${check.error}`
          : `Input '${portId}' (bag '${bagKey}') failed shape check: ${check.error}`
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
  bag: WorkflowContextBag,
  graph?: WorkflowGraph
): { ok: true } | { ok: false; error: string } {
  const pinGraph = graph && usesPinFrame(graph);
  if (pinGraph) {
    const ports = Object.keys(node.data.outputContracts ?? {});
    for (const portId of ports) {
      const contract = node.data.outputContracts?.[portId] ?? {
        required: true,
        shape: { kind: "unknown" as const }
      };
      const value = bag.frame?.pins[pinKey(node.id, portId)];
      const present = value !== undefined;
      if (!present) {
        if (isRequired(contract)) {
          return { ok: false, error: `Missing required output '${portId}'` };
        }
        continue;
      }
      if (!contract.shape) {
        continue;
      }
      const check = validateValueAgainstShape(value, contract.shape);
      if (!check.ok) {
        return { ok: false, error: `Output '${portId}' failed shape check: ${check.error}` };
      }
    }
    return { ok: true };
  }

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

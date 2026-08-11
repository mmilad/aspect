import type { BagShape, WorkflowNode } from "./types";
import { resolveWriteBindings } from "./ports";
import { resolveBagShape } from "./shapes";

export type LlmOutputContract = {
  shape: BagShape;
  required: boolean;
};

const DEFAULT_STRING: BagShape = { kind: "primitive", type: "string" };

/**
 * Resolve LLM write contracts keyed by **output port id**.
 * Prefer outputContracts / llm.outputSchema port ids; fall back to write binding ports.
 */
export function resolveLlmOutputContracts(node: WorkflowNode): {
  keys: string[];
  outputs: Record<string, LlmOutputContract>;
} {
  const fromSchema = node.data.llm?.outputSchema;
  const fromContracts = Object.keys(node.data.outputContracts ?? {});
  const fromWrites = Object.keys(resolveWriteBindings(node));
  const keys =
    fromSchema && fromSchema.length > 0
      ? [...fromSchema]
      : fromContracts.length > 0
        ? fromContracts
        : fromWrites;
  const outputs: Record<string, LlmOutputContract> = {};
  for (const key of keys) {
    const contract = node.data.outputContracts?.[key];
    outputs[key] = {
      shape: contract?.shape ? resolveBagShape(contract.shape) : DEFAULT_STRING,
      required: contract?.required !== false
    };
  }
  return { keys, outputs };
}

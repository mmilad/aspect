import type { BagShape, WorkflowNode } from "./types";
import { resolveBagShape } from "./shapes";

export type LlmOutputContract = {
  shape: BagShape;
  required: boolean;
};

const DEFAULT_STRING: BagShape = { kind: "primitive", type: "string" };

/**
 * Resolve LLM write contracts: outputContracts shapes when present,
 * else default string for each declared write / outputSchema key.
 */
export function resolveLlmOutputContracts(node: WorkflowNode): {
  keys: string[];
  outputs: Record<string, LlmOutputContract>;
} {
  const fromSchema = node.data.llm?.outputSchema;
  const keys =
    fromSchema && fromSchema.length > 0
      ? [...fromSchema]
      : [...(node.data.writes ?? node.data.outputs ?? [])];
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

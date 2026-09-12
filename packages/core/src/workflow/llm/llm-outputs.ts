import type { BagShape, WorkflowNode } from "../nodes";
import { resolveWriteBindings } from "../bag/ports";
import { BAG_SHAPE_CATALOG, resolveBagShape } from "../bag/shapes";
import { bagShapeFromLlmSchema } from "./schema-shape";

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
    const schemaShapeValue = node.data.llm?.schemaKey ? bagShapeFromLlmSchema(node.data.llm.schemaKey) : undefined;
    const explicit = contract?.shape ? resolveBagShape(contract.shape) : undefined;
    outputs[key] = {
      // A node-level output contract describes the selected port, while the
      // JSON schema describes the provider payload. Preserve the port contract
      // when both are present; otherwise a multi-field schema would incorrectly
      // validate every output port against the whole payload object.
      shape: explicit ?? schemaShapeValue ?? (node.data.llm?.schemaKey ? BAG_SHAPE_CATALOG.Json : DEFAULT_STRING),
      required: contract?.required !== false
    };
  }
  return { keys, outputs };
}

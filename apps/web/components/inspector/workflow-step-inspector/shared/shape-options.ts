import type { BagShape, WorkflowBagKeyContract } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { serializeShapeSlim } = workflow.bag;

export const SHAPE_OPTIONS: Array<{ label: string; shape: BagShape }> = [
  { label: "string", shape: { kind: "primitive", type: "string" } },
  { label: "number", shape: { kind: "primitive", type: "number" } },
  { label: "boolean", shape: { kind: "primitive", type: "boolean" } },
  { label: "object", shape: { kind: "object", fields: {} } },
  { label: "array", shape: { kind: "array", items: { kind: "any" } } },
  { label: "any", shape: { kind: "any" } }
];

export function shapeLabel(shape: BagShape | undefined): string {
  if (!shape) {
    return "unknown";
  }
  return serializeShapeSlim(shape);
}

export function requiredLabel(contract: Pick<WorkflowBagKeyContract, "required"> | undefined): string {
  return contract?.required === false ? "optional" : "required";
}

export function matchingShape(shape: BagShape | undefined): string {
  if (!shape) {
    return "any";
  }
  if (shape.kind === "primitive") {
    return SHAPE_OPTIONS.some((option) => option.label === shape.type) ? shape.type : "any";
  }
  return SHAPE_OPTIONS.some((option) => option.label === shape.kind) ? shape.kind : "any";
}

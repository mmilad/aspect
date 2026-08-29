import { findStartNode } from "./graph/schema";
import { usesPinFrame, variablesOfRole } from "./graph/variables";
import { serializeShapeSlim } from "./shapes";
import type { BagShape } from "./nodes/_shared/types";
import type { WorkflowGraph } from "./graph/types";

export type WorkflowRunInput = {
  name: string;
  required: boolean;
  shape?: BagShape;
};

/** Start-declared run inputs: pin-frame input variables when present, else Start outputContracts/writes. */
export function workflowRunInputs(graph: WorkflowGraph): WorkflowRunInput[] {
  const variableInputs = usesPinFrame(graph) ? variablesOfRole(graph, "input") : [];
  if (variableInputs.length > 0) {
    return variableInputs.map((variable) => ({
      name: variable.name,
      required: variable.required !== false,
      shape: variable.shape
    }));
  }
  const start = findStartNode(graph);
  if (!start) {
    return [];
  }
  const contracts = start.data.outputContracts ?? {};
  const names = Object.keys(contracts).length > 0 ? Object.keys(contracts) : (start.data.writes ?? []);
  return names.map((name) => ({
    name,
    required: contracts[name]?.required === true,
    shape: contracts[name]?.shape
  }));
}

export function defaultRunInputValue(shape: BagShape | undefined): unknown {
  if (!shape) {
    return "";
  }
  if (shape.kind === "primitive") {
    if (shape.type === "number") {
      return 0;
    }
    if (shape.type === "boolean") {
      return false;
    }
    if (shape.type === "null") {
      return null;
    }
    return "";
  }
  if (shape.kind === "array") {
    return [];
  }
  if (shape.kind === "object" || shape.kind === "ref") {
    return {};
  }
  if (shape.kind === "union") {
    const present = shape.options.find((option) => !(option.kind === "primitive" && option.type === "null"));
    return defaultRunInputValue(present);
  }
  return {};
}

export function seedRunInputBag(inputs: WorkflowRunInput[]): Record<string, unknown> {
  return Object.fromEntries(inputs.map((input) => [input.name, defaultRunInputValue(input.shape)]));
}

export function missingRequiredRunInputs(
  inputs: WorkflowRunInput[],
  bag: Record<string, unknown>
): string[] {
  return inputs.filter((input) => input.required && !(input.name in bag)).map((input) => input.name);
}

export function describeRunInput(input: WorkflowRunInput): string {
  const slim = serializeShapeSlim(input.shape);
  return `${input.name}${input.required ? "*" : ""}: ${slim}`;
}

import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeMath } from "./execute";
import { parseMathNodeConfig } from "./schema";

const NUMBER: BagShape = { kind: "primitive", type: "number" };

export const mathNode: WorkflowNodeModel = {
  type: "math",
  kind: "work",
  description: "Applies one arithmetic operation to a numeric input.",
  configKey: "math",
  defaultData: () => ({
    title: "Math",
    inputs: { value: { required: true, shape: NUMBER } },
    outputContracts: { result: { required: true, shape: NUMBER } },
    math: { operation: "add", operand: 0 }
  }),
  parseConfig: parseMathNodeConfig,
  execute: executeMath,
  execInputDescriptions: () => ({
    in: "Run this arithmetic operation."
  }),
  execOutputDescriptions: () => ({
    then: "Continue after the result was calculated."
  }),
  dataInputs: () => ["value"],
  dataOutputs: () => ["result"],
  canvasFields: (node) =>
    node.data.math
      ? [{ label: "math", value: `${node.data.math.operation} ${node.data.math.operand}` }]
      : []
};

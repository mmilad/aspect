import type { WorkflowNodeModel } from "../_shared/model";
import { executePush } from "./execute";
import { pushInspectorFields } from "./inspector";
import { parsePushNodeConfig } from "./schema";

export const pushNode: WorkflowNodeModel = {
  type: "push",
  kind: "work",
  description: "Appends one value into an existing array in the bag.",
  configKey: "push",
  defaultData: () => ({
    title: "Push",
    reads: [],
    writes: [],
    push: { target: "", valueFrom: "" }
  }),
  parseConfig: parsePushNodeConfig,
  execute: executePush,
  inspectorFields: pushInspectorFields,
  execInputDescriptions: () => ({
    in: "Run this array append."
  }),
  execOutputDescriptions: () => ({
    then: "Continue after the value was appended."
  }),
  dataInputs: (node) => [node.data.push?.target, node.data.push?.valueFrom].filter(Boolean) as string[],
  dataOutputs: (node) => [node.data.push?.target].filter(Boolean) as string[],
  canvasFields: (node) =>
    node.data.push
      ? [{ label: "push", value: `${node.data.push.target} <- ${node.data.push.valueFrom}` }]
      : []
};

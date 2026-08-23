import type { BagShape } from "../_shared/types";
import type { WorkflowNodeModel } from "../_shared/model";
import { executeAssembleFragment } from "./execute";
import { assembleFragmentInspectorFields } from "./inspector";
import { parseAssembleFragmentNodeConfig } from "./schema";

const JSON_SHAPE: BagShape = { kind: "any" };

export const assembleFragmentNode: WorkflowNodeModel = {
  type: "assemble_fragment",
  kind: "work",
  description: "Stitches create_step drafts into a start-to-end workflow fragment.",
  configKey: "assembleFragment",
  defaultData: () => ({
    title: "Assemble fragment",
    reads: ["stepDrafts"],
    writes: ["workflowDraft"],
    inputs: { stepDrafts: { required: true, shape: JSON_SHAPE } },
    outputContracts: { workflowDraft: { required: true, shape: JSON_SHAPE } },
    assembleFragment: { draftsFrom: "stepDrafts", outputKey: "workflowDraft" }
  }),
  parseConfig: parseAssembleFragmentNodeConfig,
  execute: executeAssembleFragment,
  inspectorFields: assembleFragmentInspectorFields,
  execInputDescriptions: () => ({
    in: "Assemble the collected step drafts."
  }),
  execOutputDescriptions: () => ({
    then: "Continue after the fragment was assembled."
  }),
  dataInputs: (node) => [node.data.assembleFragment?.draftsFrom ?? "stepDrafts"],
  dataOutputs: (node) => [node.data.assembleFragment?.outputKey ?? "workflowDraft"],
  canvasFields: (node) =>
    node.data.assembleFragment
      ? [
          {
            label: "assemble",
            value: `${node.data.assembleFragment.outputKey ?? "workflowDraft"} <- ${node.data.assembleFragment.draftsFrom}`
          }
        ]
      : []
};

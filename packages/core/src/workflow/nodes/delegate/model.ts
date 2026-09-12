import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeDelegate } from "./execute";
import { parseDelegateNodeConfig } from "./schema";
import { delegateInspectorFields } from "./inspector";

const ANY: BagShape = { kind: "any" };

export const delegateNode: WorkflowNodeModel = {
  type: "delegate",
  kind: "work",
  category: "agent",
  sideEffect: "delegate",
  configKey: "delegate",
  defaultData: () => ({
    title: "Delegate",
    inputs: {
      agentId: { required: false, shape: { kind: "primitive", type: "string" } },
      task: { required: false, shape: { kind: "primitive", type: "string" } },
      runId: { required: false, shape: { kind: "primitive", type: "string" } },
      message: { required: false, shape: { kind: "primitive", type: "string" } },
      pendingDelegation: { required: false, shape: ANY }
    },
    outputContracts: {
      delegation: { required: true, shape: ANY },
      delegationRunId: { required: true, shape: { kind: "primitive", type: "string" } },
      delegationAgentId: { required: true, shape: { kind: "primitive", type: "string" } },
      delegationStatus: { required: true, shape: { kind: "primitive", type: "string" } },
      delegationResult: { required: false, shape: ANY },
      delegationQuestion: { required: false, shape: ANY },
      delegationError: { required: false, shape: ANY },
      pendingDelegation: { required: false, shape: ANY }
    },
    delegate: {}
  }),
  parseConfig: parseDelegateNodeConfig,
  execute: executeDelegate,
  inspectorFields: delegateInspectorFields,
  execInputDescriptions: () => ({ in: "Start or resume a specialized agent run." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed agent result." }),
  dataInputs: (node) => Object.keys(node.data.inputs ?? {}),
  dataOutputs: (node) => Object.keys(node.data.outputContracts ?? {})
};

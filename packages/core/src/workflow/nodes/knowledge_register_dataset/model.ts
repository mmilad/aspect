import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeRegisterDataset } from "./execute";
import { parseKnowledgeRegisterDatasetNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const STRINGS: BagShape = { kind: "array", items: STRING };
const ANY: BagShape = { kind: "any" };

export const knowledgeRegisterDatasetNode: WorkflowNodeModel = {
  type: "knowledge_register_dataset",
  kind: "work",
  category: "operation",
  sideEffect: "write",
  configKey: "knowledgeRegisterDataset",
  defaultData: () => ({
    title: "Register knowledge dataset",
    inputs: {
      datasetKey: { required: true, shape: STRING },
      displayName: { required: true, shape: STRING },
      schemaVersion: { required: true, shape: STRING },
      semanticDescription: { required: true, shape: STRING },
      usageGuidance: { required: true, shape: STRING },
      llmSummary: { required: false, shape: STRING },
      contentKind: { required: false, shape: STRING },
      retrievalCapabilities: { required: false, shape: STRINGS },
      capabilityTags: { required: false, shape: STRINGS },
      entityTypes: { required: false, shape: STRINGS },
      filterableFields: { required: false, shape: STRINGS },
      metadata: { required: false, shape: ANY }
    },
    outputContracts: {
      datasetKey: { required: true, shape: STRING },
      registered: { required: true, shape: BOOLEAN },
      displayName: { required: true, shape: STRING },
      schemaVersion: { required: true, shape: STRING }
    },
    knowledgeRegisterDataset: {}
  }),
  parseConfig: parseKnowledgeRegisterDatasetNodeConfig,
  execute: executeKnowledgeRegisterDataset,
  dataInputs: () => ["datasetKey", "displayName", "schemaVersion", "semanticDescription", "usageGuidance", "llmSummary", "contentKind", "retrievalCapabilities", "capabilityTags", "entityTypes", "filterableFields", "metadata"],
  dataOutputs: () => ["datasetKey", "registered", "displayName", "schemaVersion"],
  execInputDescriptions: () => ({ in: "Register or update a dataset definition in the configured knowledge service." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed dataset registration." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.register_dataset" }]
};

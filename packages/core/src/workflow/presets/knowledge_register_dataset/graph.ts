import { WORKFLOW_SCHEMA_VERSION, type BagShape, type WorkflowNode } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const STRINGS: BagShape = { kind: "array", items: STRING };
const ANY: BagShape = { kind: "any" };
const inputKeys = ["datasetKey", "displayName", "schemaVersion", "semanticDescription", "usageGuidance", "llmSummary", "contentKind", "retrievalCapabilities", "capabilityTags", "entityTypes", "filterableFields", "metadata"];

function registerNode(): WorkflowNode {
  return {
    id: "register",
    type: "knowledge_register_dataset",
    position: { x: 340, y: 180 },
    data: {
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
      writeBindings: {
        datasetKey: "registeredDatasetKey",
        registered: "registered",
        displayName: "registeredDisplayName",
        schemaVersion: "registeredSchemaVersion"
      },
      knowledgeRegisterDataset: {}
    }
  };
}

export const knowledgeRegisterDatasetGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    ...inputKeys.map((name) => ({ name, role: "input" as const, shape: ["retrievalCapabilities", "capabilityTags", "entityTypes", "filterableFields"].includes(name) ? STRINGS : name === "metadata" ? ANY : STRING, required: ["datasetKey", "displayName", "schemaVersion", "semanticDescription", "usageGuidance"].includes(name) })),
    { name: "registered", role: "output", shape: BOOLEAN, required: true },
    { name: "registeredDatasetKey", role: "output", shape: STRING, required: true },
    { name: "registeredDisplayName", role: "output", shape: STRING, required: true },
    { name: "registeredSchemaVersion", role: "output", shape: STRING, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 180 },
      data: {
        title: "Start",
        writes: inputKeys,
        writeBindings: identityBindings(inputKeys),
        outputContracts: Object.fromEntries(inputKeys.map((key) => [key, { required: ["datasetKey", "displayName", "schemaVersion", "semanticDescription", "usageGuidance"].includes(key), shape: ["retrievalCapabilities", "capabilityTags", "entityTypes", "filterableFields"].includes(key) ? STRINGS : key === "metadata" ? ANY : STRING }]))
      }
    },
    registerNode(),
    { id: "end", type: "end", position: { x: 700, y: 180 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_register", source: "start", target: "register", kind: "next" },
    { id: "e_register_end", source: "register", target: "end", kind: "next" },
    ...inputKeys.map((key) => ({ id: `d_${key}`, source: "start", target: "register", kind: "data" as const, sourcePin: key, targetPin: key })),
    { id: "d_dataset_key_end", source: "register", target: "end", kind: "data", sourcePin: "datasetKey", targetPin: "registeredDatasetKey" },
    { id: "d_registered_end", source: "register", target: "end", kind: "data", sourcePin: "registered", targetPin: "registered" },
    { id: "d_display_name_end", source: "register", target: "end", kind: "data", sourcePin: "displayName", targetPin: "registeredDisplayName" },
    { id: "d_schema_version_end", source: "register", target: "end", kind: "data", sourcePin: "schemaVersion", targetPin: "registeredSchemaVersion" }
  ]
};

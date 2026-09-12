import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeIngest } from "./execute";
import { parseKnowledgeIngestNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRINGS: BagShape = { kind: "array", items: STRING };

export const knowledgeIngestNode: WorkflowNodeModel = {
  type: "knowledge_ingest",
  kind: "work",
  category: "operation",
  sideEffect: "write",
  configKey: "knowledgeIngest",
  defaultData: () => ({
    title: "Ingest Knowledge",
    inputs: {
      datasetKey: { required: true, shape: STRING },
      rawText: { required: true, shape: STRING },
      itemId: { required: false, shape: STRING },
      metadata: { required: false, shape: { kind: "any" } },
      scope: { required: false, shape: { kind: "any" } }
    },
    outputContracts: {
      ingested: { required: true, shape: NUMBER },
      ids: { required: true, shape: STRINGS },
      embeddingModel: { required: true, shape: NULLABLE_STRING }
    },
    knowledgeIngest: {}
  }),
  parseConfig: parseKnowledgeIngestNodeConfig,
  execute: executeKnowledgeIngest,
  dataInputs: () => ["datasetKey", "rawText", "itemId", "metadata", "scope"],
  dataOutputs: () => ["ingested", "ids", "embeddingModel"],
  execInputDescriptions: () => ({ in: "Persist and embed the supplied knowledge item." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed ingest result." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.ingest" }]
};

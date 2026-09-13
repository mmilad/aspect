import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeIngestText } from "./execute";
import { parseKnowledgeIngestTextNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRINGS: BagShape = { kind: "array", items: STRING };

export const knowledgeIngestTextNode: WorkflowNodeModel = {
  type: "knowledge_ingest_text",
  kind: "work",
  category: "operation",
  sideEffect: "write",
  configKey: "knowledgeIngestText",
  defaultData: () => ({
    title: "Ingest text into knowledge",
    inputs: {
      datasetKey: { required: true, shape: STRING },
      text: { required: true, shape: STRING },
      metadata: { required: false, shape: { kind: "any" } },
      scope: { required: true, shape: { kind: "any" } },
      maxChars: { required: false, shape: NUMBER },
      overlapChars: { required: false, shape: NUMBER },
      ingestionId: { required: false, shape: STRING },
      batchSize: { required: false, shape: NUMBER },
      processorStrategy: { required: false, shape: STRING },
      extractPrimitives: { required: false, shape: BOOLEAN }
    },
    outputContracts: {
      ingested: { required: true, shape: NUMBER },
      ids: { required: true, shape: STRINGS },
      embeddingModel: { required: true, shape: NULLABLE_STRING }
    },
    knowledgeIngestText: {}
  }),
  parseConfig: parseKnowledgeIngestTextNodeConfig,
  execute: executeKnowledgeIngestText,
  dataInputs: () => ["datasetKey", "text", "metadata", "scope", "maxChars", "overlapChars", "ingestionId", "batchSize", "processorStrategy", "extractPrimitives"],
  dataOutputs: () => ["ingested", "ids", "embeddingModel"],
  execInputDescriptions: () => ({ in: "Chunk, optionally classify, embed, and persist a scoped text source." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed ingest result." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.ingest_text" }]
};

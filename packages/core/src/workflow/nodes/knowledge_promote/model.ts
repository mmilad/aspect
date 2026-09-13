import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgePromote } from "./execute";
import { parseKnowledgePromoteNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ANY: BagShape = { kind: "any" };
const STRINGS: BagShape = { kind: "array", items: STRING };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };

export const knowledgePromoteNode: WorkflowNodeModel = {
  type: "knowledge_promote",
  kind: "work",
  category: "operation",
  sideEffect: "write",
  configKey: "knowledgePromote",
  defaultData: () => ({
    title: "Promote knowledge",
    inputs: {
      classification: { required: true, shape: ANY },
      datasetKey: { required: true, shape: STRING },
      canonicalText: { required: false, shape: STRING },
      metadata: { required: false, shape: ANY },
      scope: { required: true, shape: ANY },
      confirmed: { required: true, shape: BOOLEAN },
      ingestionId: { required: false, shape: STRING },
      sourceId: { required: false, shape: STRING }
    },
    outputContracts: {
      status: { required: true, shape: STRING },
      reason: { required: true, shape: STRING },
      ingested: { required: true, shape: NUMBER },
      ids: { required: true, shape: STRINGS },
      embeddingModel: { required: true, shape: NULLABLE_STRING }
    },
    knowledgePromote: {}
  }),
  parseConfig: parseKnowledgePromoteNodeConfig,
  execute: executeKnowledgePromote,
  dataInputs: () => ["classification", "datasetKey", "canonicalText", "metadata", "scope", "confirmed", "ingestionId", "sourceId"],
  dataOutputs: () => ["status", "reason", "ingested", "ids", "embeddingModel"],
  execInputDescriptions: () => ({ in: "Store explicitly confirmed classified knowledge in its declared scope." }),
  execOutputDescriptions: () => ({ then: "Continue with the confirmed promotion status." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.promote" }]
};

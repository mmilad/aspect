import type { WorkflowNodeModel } from "../_shared/model";
import type { BagShape } from "../_shared/types";
import { executeKnowledgeSearch } from "./execute";
import { parseKnowledgeSearchNodeConfig } from "./schema";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const ANY: BagShape = { kind: "any" };
const HITS: BagShape = { kind: "array", items: { kind: "ref", ref: "Json" } };

export const knowledgeSearchNode: WorkflowNodeModel = {
  type: "knowledge_search",
  kind: "work",
  category: "operation",
  sideEffect: "read",
  configKey: "knowledgeSearch",
  defaultData: () => ({
    title: "Knowledge Search",
    inputs: {
      datasetKey: { required: false, shape: STRING },
      query: { required: true, shape: STRING },
      topK: { required: false, shape: NUMBER },
      keywordQuery: { required: false, shape: STRING },
      metadataFilters: { required: false, shape: ANY },
      vectorWeight: { required: false, shape: NUMBER },
      access: { required: false, shape: ANY }
    },
    outputContracts: {
      hits: { required: true, shape: HITS },
      query: { required: true, shape: STRING },
      embeddingModel: { required: true, shape: NULLABLE_STRING },
      totalSearched: { required: true, shape: NUMBER },
      searchMode: { required: true, shape: STRING }
    },
    knowledgeSearch: {}
  }),
  parseConfig: parseKnowledgeSearchNodeConfig,
  execute: executeKnowledgeSearch,
  dataInputs: () => ["datasetKey", "query", "topK", "keywordQuery", "metadataFilters", "vectorWeight", "access"],
  dataOutputs: () => ["hits", "query", "embeddingModel", "totalSearched", "searchMode"],
  execInputDescriptions: () => ({ in: "Search the configured knowledge dataset." }),
  execOutputDescriptions: () => ({ then: "Continue with the grounded search results." }),
  canvasFields: () => [{ label: "capability", value: "knowledge.search" }]
};

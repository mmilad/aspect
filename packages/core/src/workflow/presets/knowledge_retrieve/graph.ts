import { WORKFLOW_SCHEMA_VERSION, type BagShape } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ANY: BagShape = { kind: "any" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const HITS: BagShape = { kind: "array", items: ANY };
const inputKeys = ["datasetKey", "query", "topK", "keywordQuery", "metadataFilters", "vectorWeight", "access"];

export const knowledgeRetrieveGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "datasetKey", role: "input", shape: STRING, required: true },
    { name: "query", role: "input", shape: STRING, required: true },
    { name: "topK", role: "input", shape: NUMBER, required: false },
    { name: "keywordQuery", role: "input", shape: STRING, required: false },
    { name: "metadataFilters", role: "input", shape: ANY, required: false },
    { name: "vectorWeight", role: "input", shape: NUMBER, required: false },
    { name: "access", role: "input", shape: ANY, required: false },
    { name: "hits", role: "output", shape: HITS, required: true },
    { name: "searchQuery", role: "output", shape: STRING, required: true },
    { name: "embeddingModel", role: "output", shape: NULLABLE_STRING, required: true },
    { name: "totalSearched", role: "output", shape: NUMBER, required: true },
    { name: "searchMode", role: "output", shape: STRING, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 220 },
      data: {
        title: "Start",
        writes: inputKeys,
        writeBindings: identityBindings(inputKeys),
        outputContracts: {
          datasetKey: { required: true, shape: STRING },
          query: { required: true, shape: STRING },
          topK: { required: false, shape: NUMBER },
          keywordQuery: { required: false, shape: STRING },
          metadataFilters: { required: false, shape: ANY },
          vectorWeight: { required: false, shape: NUMBER },
          access: { required: false, shape: ANY }
        }
      }
    },
    {
      id: "search",
      type: "knowledge_search",
      position: { x: 360, y: 220 },
      data: {
        title: "Search knowledge",
        inputs: {
          datasetKey: { required: true, shape: STRING },
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
      }
    },
    { id: "end", type: "end", position: { x: 680, y: 220 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_search", source: "start", target: "search", kind: "next" },
    { id: "e_search_end", source: "search", target: "end", kind: "next" },
    ...inputKeys.map((key) => ({ id: `d_input_${key}`, source: "start", target: "search", kind: "data" as const, sourcePin: key, targetPin: key })),
    { id: "d_hits", source: "search", target: "end", kind: "data", sourcePin: "hits", targetPin: "hits" },
    { id: "d_query", source: "search", target: "end", kind: "data", sourcePin: "query", targetPin: "searchQuery" },
    { id: "d_embedding_model", source: "search", target: "end", kind: "data", sourcePin: "embeddingModel", targetPin: "embeddingModel" },
    { id: "d_total", source: "search", target: "end", kind: "data", sourcePin: "totalSearched", targetPin: "totalSearched" },
    { id: "d_mode", source: "search", target: "end", kind: "data", sourcePin: "searchMode", targetPin: "searchMode" }
  ]
};

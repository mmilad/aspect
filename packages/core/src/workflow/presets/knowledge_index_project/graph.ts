import { WORKFLOW_SCHEMA_VERSION, type BagShape } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRINGS: BagShape = { kind: "array", items: STRING };
const inputKeys = ["projectKey", "datasetKey", "limit", "includeArchived"];

export const knowledgeIndexProjectGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "projectKey", role: "input", shape: STRING, required: true },
    { name: "datasetKey", role: "input", shape: STRING, required: true },
    { name: "limit", role: "input", shape: NUMBER, required: false },
    { name: "includeArchived", role: "input", shape: BOOLEAN, required: false },
    { name: "indexed", role: "output", shape: NUMBER, required: true },
    { name: "ids", role: "output", shape: STRINGS, required: true },
    { name: "skipped", role: "output", shape: NUMBER, required: true },
    { name: "embeddingModel", role: "output", shape: NULLABLE_STRING, required: true }
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
          projectKey: { required: true, shape: STRING },
          datasetKey: { required: true, shape: STRING },
          limit: { required: false, shape: NUMBER },
          includeArchived: { required: false, shape: BOOLEAN }
        }
      }
    },
    {
      id: "index",
      type: "knowledge_index_project",
      position: { x: 360, y: 220 },
      data: {
        title: "Index project entities",
        inputs: {
          projectKey: { required: true, shape: STRING },
          datasetKey: { required: true, shape: STRING },
          limit: { required: false, shape: NUMBER },
          includeArchived: { required: false, shape: BOOLEAN }
        },
        outputContracts: {
          indexed: { required: true, shape: NUMBER },
          ids: { required: true, shape: STRINGS },
          skipped: { required: true, shape: NUMBER },
          embeddingModel: { required: true, shape: NULLABLE_STRING }
        },
        knowledgeIndexProject: {}
      }
    },
    { id: "end", type: "end", position: { x: 680, y: 220 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_index", source: "start", target: "index", kind: "next" },
    { id: "e_index_end", source: "index", target: "end", kind: "next" },
    ...inputKeys.map((key) => ({ id: `d_input_${key}`, source: "start", target: "index", kind: "data" as const, sourcePin: key, targetPin: key })),
    { id: "d_indexed", source: "index", target: "end", kind: "data", sourcePin: "indexed", targetPin: "indexed" },
    { id: "d_ids", source: "index", target: "end", kind: "data", sourcePin: "ids", targetPin: "ids" },
    { id: "d_skipped", source: "index", target: "end", kind: "data", sourcePin: "skipped", targetPin: "skipped" },
    { id: "d_embedding_model", source: "index", target: "end", kind: "data", sourcePin: "embeddingModel", targetPin: "embeddingModel" }
  ]
};

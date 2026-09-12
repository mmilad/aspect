import { WORKFLOW_SCHEMA_VERSION, type BagShape, type WorkflowNode } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ANY: BagShape = { kind: "any" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRING_ARRAY: BagShape = { kind: "array", items: STRING };
const inputKeys = ["datasetKey", "rawText", "itemId", "metadata", "scope"];

function ingestNode(): WorkflowNode {
  return {
    id: "ingest",
    type: "knowledge_ingest",
    position: { x: 300, y: 160 },
    data: {
      title: "Ingest knowledge",
      inputs: {
        datasetKey: { required: true, shape: STRING },
        rawText: { required: true, shape: STRING },
        itemId: { required: false, shape: STRING },
        metadata: { required: false, shape: ANY },
        scope: { required: false, shape: ANY }
      },
      outputContracts: {
        ingested: { required: true, shape: NUMBER },
        ids: { required: true, shape: STRING_ARRAY },
        embeddingModel: { required: true, shape: NULLABLE_STRING }
      },
      knowledgeIngest: {}
    }
  };
}

export const knowledgeCaptureGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "datasetKey", role: "input", shape: STRING, required: true },
    { name: "rawText", role: "input", shape: STRING, required: true },
    { name: "itemId", role: "input", shape: STRING, required: false },
    { name: "metadata", role: "input", shape: ANY, required: false },
    { name: "scope", role: "input", shape: ANY, required: false },
    { name: "ingested", role: "output", shape: NUMBER, required: true },
    { name: "ids", role: "output", shape: STRING_ARRAY, required: true },
    { name: "embeddingModel", role: "output", shape: NULLABLE_STRING, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 160 },
      data: {
        title: "Start",
        writes: inputKeys,
        writeBindings: identityBindings(inputKeys),
        outputContracts: {
          datasetKey: { required: true, shape: STRING },
          rawText: { required: true, shape: STRING },
          itemId: { required: false, shape: STRING },
          metadata: { required: false, shape: ANY },
          scope: { required: false, shape: ANY }
        }
      }
    },
    ingestNode(),
    { id: "end", type: "end", position: { x: 600, y: 160 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_ingest", source: "start", target: "ingest", kind: "next" },
    { id: "e_ingest_end", source: "ingest", target: "end", kind: "next" },
    { id: "d_dataset_key", source: "start", target: "ingest", kind: "data", sourcePin: "datasetKey", targetPin: "datasetKey" },
    { id: "d_raw_text", source: "start", target: "ingest", kind: "data", sourcePin: "rawText", targetPin: "rawText" },
    { id: "d_item_id", source: "start", target: "ingest", kind: "data", sourcePin: "itemId", targetPin: "itemId" },
    { id: "d_metadata", source: "start", target: "ingest", kind: "data", sourcePin: "metadata", targetPin: "metadata" },
    { id: "d_scope", source: "start", target: "ingest", kind: "data", sourcePin: "scope", targetPin: "scope" },
    { id: "d_ingested_end", source: "ingest", target: "end", kind: "data", sourcePin: "ingested", targetPin: "ingested" },
    { id: "d_ids_end", source: "ingest", target: "end", kind: "data", sourcePin: "ids", targetPin: "ids" },
    { id: "d_embedding_model_end", source: "ingest", target: "end", kind: "data", sourcePin: "embeddingModel", targetPin: "embeddingModel" }
  ]
};

import { WORKFLOW_SCHEMA_VERSION, type BagShape, type WorkflowNode } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const ANY: BagShape = { kind: "any" };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };
const STRING_ARRAY: BagShape = { kind: "array", items: STRING };

const inputKeys = ["datasetKey", "filePath", "ingestionId", "metadata", "scope", "maxBytes"];

function readNode(): WorkflowNode {
  return {
    id: "read",
    type: "file_read",
    position: { x: 240, y: 160 },
    data: {
      title: "Read approved workspace file",
      inputs: {
        path: { required: true, shape: STRING },
        maxBytes: { required: false, shape: NUMBER }
      },
      outputContracts: {
        path: { required: true, shape: STRING },
        content: { required: true, shape: STRING },
        bytes: { required: true, shape: NUMBER },
        truncated: { required: true, shape: BOOLEAN },
        encoding: { required: true, shape: STRING }
      },
      fileRead: {}
    }
  };
}

function ingestNode(): WorkflowNode {
  return {
    id: "ingest",
    type: "knowledge_ingest_text",
    position: { x: 520, y: 160 },
    data: {
      title: "Ingest file content",
      inputs: {
        datasetKey: { required: true, shape: STRING },
        text: { required: true, shape: STRING },
        ingestionId: { required: false, shape: STRING },
        metadata: { required: false, shape: ANY },
        scope: { required: false, shape: ANY }
      },
      outputContracts: {
        ingested: { required: true, shape: NUMBER },
        ids: { required: true, shape: STRING_ARRAY },
        embeddingModel: { required: true, shape: NULLABLE_STRING }
      },
      knowledgeIngestText: {}
    }
  };
}

export const knowledgeCaptureFileGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "datasetKey", role: "input", shape: STRING, required: true },
    { name: "filePath", role: "input", shape: STRING, required: true },
    { name: "ingestionId", role: "input", shape: STRING, required: false },
    { name: "metadata", role: "input", shape: ANY, required: false },
    { name: "scope", role: "input", shape: ANY, required: false },
    { name: "maxBytes", role: "input", shape: NUMBER, required: false },
    { name: "sourcePath", role: "output", shape: STRING, required: true },
    { name: "sourceBytes", role: "output", shape: NUMBER, required: true },
    { name: "truncated", role: "output", shape: BOOLEAN, required: true },
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
          filePath: { required: true, shape: STRING },
          ingestionId: { required: false, shape: STRING },
          metadata: { required: false, shape: ANY },
          scope: { required: false, shape: ANY },
          maxBytes: { required: false, shape: NUMBER }
        }
      }
    },
    readNode(),
    ingestNode(),
    { id: "end", type: "end", position: { x: 800, y: 160 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_read", source: "start", target: "read", kind: "next" },
    { id: "e_read_ingest", source: "read", target: "ingest", kind: "next" },
    { id: "e_ingest_end", source: "ingest", target: "end", kind: "next" },
    { id: "d_file_path", source: "start", target: "read", kind: "data", sourcePin: "filePath", targetPin: "path" },
    { id: "d_max_bytes", source: "start", target: "read", kind: "data", sourcePin: "maxBytes", targetPin: "maxBytes" },
    { id: "d_dataset_key", source: "start", target: "ingest", kind: "data", sourcePin: "datasetKey", targetPin: "datasetKey" },
    { id: "d_content", source: "read", target: "ingest", kind: "data", sourcePin: "content", targetPin: "text" },
    { id: "d_ingestion_id", source: "start", target: "ingest", kind: "data", sourcePin: "ingestionId", targetPin: "ingestionId" },
    { id: "d_metadata", source: "start", target: "ingest", kind: "data", sourcePin: "metadata", targetPin: "metadata" },
    { id: "d_scope", source: "start", target: "ingest", kind: "data", sourcePin: "scope", targetPin: "scope" },
    { id: "d_source_path", source: "read", target: "end", kind: "data", sourcePin: "path", targetPin: "sourcePath" },
    { id: "d_source_bytes", source: "read", target: "end", kind: "data", sourcePin: "bytes", targetPin: "sourceBytes" },
    { id: "d_truncated", source: "read", target: "end", kind: "data", sourcePin: "truncated", targetPin: "truncated" },
    { id: "d_ingested", source: "ingest", target: "end", kind: "data", sourcePin: "ingested", targetPin: "ingested" },
    { id: "d_ids", source: "ingest", target: "end", kind: "data", sourcePin: "ids", targetPin: "ids" },
    { id: "d_embedding_model", source: "ingest", target: "end", kind: "data", sourcePin: "embeddingModel", targetPin: "embeddingModel" }
  ]
};

import type { WorkflowPreset } from "../types";
import { knowledgeCaptureGraph } from "./graph";

export const knowledgeCapturePreset: WorkflowPreset = {
  presetKey: "knowledge_capture",
  presetVersion: 2,
  title: "Capture knowledge",
  summary: "Explicitly ingest one approved source item through the configured knowledge service.",
  body: [
    "Inputs: datasetKey and rawText; optional itemId, metadata, and scope.",
    "The workflow chunks text through the typed knowledge_ingest_text node and returns only its confirmed ingest count, ids, and embedding model.",
    "Use this from an explicit user-authorized or specialist workflow. The Assistant turn is read-only and cannot run this graph directly."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeCaptureGraph
};

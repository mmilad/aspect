import type { WorkflowPreset } from "../types";
import { knowledgeCaptureFileGraph } from "./graph";

export const knowledgeCaptureFilePreset: WorkflowPreset = {
  presetKey: "knowledge_capture_file",
  presetVersion: 2,
  title: "Capture workspace file",
  summary: "Read one approved workspace file and ingest its bounded content into scoped knowledge.",
  body: [
    "Inputs: datasetKey, filePath, and an explicit scope; optional ingestionId, metadata, and maxBytes.",
    "The workflow reads the file through the bounded workspace adapter, then passes the confirmed content to the typed knowledge_ingest_text node.",
    "Use this from an explicit user-authorized or specialist workflow. The Assistant turn is read-only and cannot run this graph directly."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeCaptureFileGraph
};

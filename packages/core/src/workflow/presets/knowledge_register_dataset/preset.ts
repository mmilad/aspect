import type { WorkflowPreset } from "../types";
import { knowledgeRegisterDatasetGraph } from "./graph";

export const knowledgeRegisterDatasetPreset: WorkflowPreset = {
  presetKey: "knowledge_register_dataset",
  presetVersion: 1,
  title: "Register knowledge dataset",
  summary: "Create or update the explicit dataset definition required before knowledge ingest and retrieval.",
  body: [
    "Inputs: dataset identity, semantic description, usage guidance, and optional retrieval metadata.",
    "Registration is idempotent at the CortexDB dataset registry and is intentionally exposed as a workflow operation so ingest and retrieval remain inspectable.",
    "The Assistant is read-only and cannot run this workflow directly."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeRegisterDatasetGraph
};

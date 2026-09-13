import type { WorkflowPreset } from "../types";
import { knowledgeRetrieveGraph } from "./graph";

export const knowledgeRetrievePreset: WorkflowPreset = {
  presetKey: "knowledge_retrieve",
  presetVersion: 1,
  title: "Retrieve knowledge",
  summary: "Search the configured knowledge service through an explicit, read-only workflow.",
  body: [
    "Inputs: datasetKey, query, and optional ranking, metadata, and access controls.",
    "Outputs: normalized hits plus search mode and embedding metadata returned by the configured knowledge service.",
    "This workflow does not write to CortexDB or the project graph. Use it to make context retrieval inspectable and composable."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeRetrieveGraph
};

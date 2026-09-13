import type { WorkflowPreset } from "../types";
import { knowledgeIndexProjectGraph } from "./graph";

export const knowledgeIndexProjectPreset: WorkflowPreset = {
  presetKey: "knowledge_index_project",
  presetVersion: 1,
  title: "Index project knowledge",
  summary: "Project the current graph into scoped CortexDB memory through an explicit workflow.",
  body: [
    "Inputs: projectKey, datasetKey, and optional limit/includeArchived controls.",
    "Each entity keeps its Projectplaner ID as source metadata and uses project scope; rerunning uses stable ingestion IDs.",
    "This is a specialist or migration workflow and is rejected for the Assistant actor."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeIndexProjectGraph
};

import type { WorkflowPreset } from "../types";
import { knowledgePromoteGraph } from "./graph";

export const knowledgePromotePreset: WorkflowPreset = {
  presetKey: "knowledge_promote",
  presetVersion: 1,
  title: "Promote confirmed knowledge",
  summary: "Store explicitly confirmed classified knowledge in an explicit scope.",
  body: [
    "Inputs: a knowledge_classification_v1 result, datasetKey, scope, confirmation, and a stable ingestionId or sourceId.",
    "Ignore and unconfirmed classifications produce a status without writing.",
    "Confirmed candidate or durable classifications are create-only projections into CortexDB with provenance metadata.",
    "This workflow does not update or supersede existing facts; those operations require a later explicit workflow. The Assistant actor cannot run it."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgePromoteGraph
};

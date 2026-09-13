import type { WorkflowPreset } from "../types";
import { knowledgeRememberGraph } from "./graph";

export const knowledgeRememberPreset: WorkflowPreset = {
  presetKey: "knowledge_remember",
  presetVersion: 1,
  title: "Remember knowledge",
  summary: "Classify a proposed memory and promote it only with an explicit scope and confirmation.",
  body: [
    "Inputs: rawText, datasetKey, explicit scope, confirmation, and optional provenance metadata.",
    "The first step is a strict, non-mutating knowledge classification.",
    "Ignore or unconfirmed classifications return a status without writing.",
    "Confirmed candidate or durable classifications are stored through the typed knowledge promotion node.",
    "This workflow does not modify the project graph and is not available to the read-only Assistant actor."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeRememberGraph
};

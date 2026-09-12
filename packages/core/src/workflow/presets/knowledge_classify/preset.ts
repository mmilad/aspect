import type { WorkflowPreset } from "../types";
import { knowledgeClassifyGraph } from "./graph";

export const knowledgeClassifyPreset: WorkflowPreset = {
  presetKey: "knowledge_classify",
  presetVersion: 1,
  title: "Classify knowledge",
  summary: "Produce a strict, non-mutating classification proposal before knowledge promotion.",
  body: [
    "Inputs: rawText, optional metadata, and optional projectKey.",
    "Output: classification with decision, kind, confidence, canonical text, source quote, suggested scope, and confirmation requirement.",
    "This workflow never writes to CortexDB or the project graph. A later promotion workflow must enforce authorization and scope."
  ].join(" "),
  status: "accepted",
  kind: "user",
  graph: knowledgeClassifyGraph
};

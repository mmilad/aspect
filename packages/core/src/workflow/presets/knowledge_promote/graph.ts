import { WORKFLOW_SCHEMA_VERSION, type BagShape, type WorkflowNode } from "../../nodes";
import type { WorkflowGraph } from "../../graph";
import { identityBindings } from "../bindings";

const STRING: BagShape = { kind: "primitive", type: "string" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const ANY: BagShape = { kind: "any" };
const STRINGS: BagShape = { kind: "array", items: STRING };
const NULLABLE_STRING: BagShape = { kind: "union", options: [STRING, { kind: "primitive", type: "null" }] };

const inputKeys = ["classification", "datasetKey", "canonicalText", "metadata", "scope", "confirmed", "ingestionId", "sourceId"];

function promoteNode(): WorkflowNode {
  return {
    id: "promote",
    type: "knowledge_promote",
    position: { x: 340, y: 180 },
    data: {
      title: "Promote confirmed knowledge",
      inputs: {
        classification: { required: true, shape: ANY },
        datasetKey: { required: true, shape: STRING },
        canonicalText: { required: false, shape: STRING },
        metadata: { required: false, shape: ANY },
        scope: { required: true, shape: ANY },
        confirmed: { required: true, shape: BOOLEAN },
        ingestionId: { required: false, shape: STRING },
        sourceId: { required: false, shape: STRING }
      },
      outputContracts: {
        status: { required: true, shape: STRING },
        reason: { required: true, shape: STRING },
        ingested: { required: true, shape: NUMBER },
        ids: { required: true, shape: STRINGS },
        embeddingModel: { required: true, shape: NULLABLE_STRING }
      },
      writeBindings: {
        status: "status",
        reason: "reason",
        ingested: "ingested",
        ids: "ids",
        embeddingModel: "embeddingModel"
      },
      knowledgePromote: {}
    }
  };
}

export const knowledgePromoteGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  variables: [
    { name: "classification", role: "input", shape: ANY, required: true },
    { name: "datasetKey", role: "input", shape: STRING, required: true },
    { name: "canonicalText", role: "input", shape: STRING, required: false },
    { name: "metadata", role: "input", shape: ANY, required: false },
    { name: "scope", role: "input", shape: ANY, required: true },
    { name: "confirmed", role: "input", shape: BOOLEAN, required: true },
    { name: "ingestionId", role: "input", shape: STRING, required: false },
    { name: "sourceId", role: "input", shape: STRING, required: false },
    { name: "status", role: "output", shape: STRING, required: true },
    { name: "reason", role: "output", shape: STRING, required: true },
    { name: "ingested", role: "output", shape: NUMBER, required: true },
    { name: "ids", role: "output", shape: STRINGS, required: true },
    { name: "embeddingModel", role: "output", shape: NULLABLE_STRING, required: true }
  ],
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 180 },
      data: {
        title: "Start",
        writes: inputKeys,
        writeBindings: identityBindings(inputKeys),
        outputContracts: {
          classification: { required: true, shape: ANY },
          datasetKey: { required: true, shape: STRING },
          canonicalText: { required: false, shape: STRING },
          metadata: { required: false, shape: ANY },
          scope: { required: true, shape: ANY },
          confirmed: { required: true, shape: BOOLEAN },
          ingestionId: { required: false, shape: STRING },
          sourceId: { required: false, shape: STRING }
        }
      }
    },
    promoteNode(),
    { id: "end", type: "end", position: { x: 700, y: 180 }, data: { title: "End" } }
  ],
  edges: [
    { id: "e_start_promote", source: "start", target: "promote", kind: "next" },
    { id: "e_promote_end", source: "promote", target: "end", kind: "next" },
    ...inputKeys.map((key) => ({ id: `d_${key}`, source: "start", target: "promote", kind: "data" as const, sourcePin: key, targetPin: key })),
    ...["status", "reason", "ingested", "ids", "embeddingModel"].map((key) => ({ id: `d_${key}_end`, source: "promote", target: "end", kind: "data" as const, sourcePin: key, targetPin: key }))
  ]
};

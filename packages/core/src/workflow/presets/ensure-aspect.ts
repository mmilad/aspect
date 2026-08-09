import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { WorkflowPreset } from "./types";

/**
 * Ensure Aspect — search for a similar aspect before create_entity.
 * Prefer reuse; create only when needed. Keep LLM context slim via map.
 */
export const ensureAspectGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 160 },
      data: {
        title: "Start",
        writes: ["title", "summary", "key", "reason", "parentAspectId"],
        outputContracts: {
          title: { required: true, shape: { kind: "primitive", type: "string" } },
          summary: { required: false, shape: { kind: "primitive", type: "string" } },
          key: { required: false, shape: { kind: "primitive", type: "string" } },
          reason: { required: true, shape: { kind: "primitive", type: "string" } },
          parentAspectId: { required: false, shape: { kind: "primitive", type: "string" } }
        }
      }
    },
    {
      id: "load",
      type: "context",
      position: { x: 260, y: 160 },
      data: {
        title: "Search aspects",
        reads: ["title"],
        writes: ["matches"],
        auto: {
          loadContext: {
            mode: "query",
            queryFrom: "title",
            types: ["aspect"],
            limit: 12
          }
        },
        outputContracts: {
          matches: { shape: { kind: "array", items: { kind: "ref", ref: "Entity" } } }
        }
      }
    },
    {
      id: "slim",
      type: "map",
      position: { x: 480, y: 160 },
      data: {
        title: "Slim candidates",
        reads: ["matches"],
        writes: ["candidates"],
        map: {
          from: "matches",
          as: "candidates",
          mode: "array",
          fields: [
            { from: "id", as: "id" },
            { from: "title", as: "title" },
            { from: "status", as: "status" },
            { from: "summary", as: "summary" }
          ]
        }
      }
    },
    {
      id: "decide",
      type: "llm",
      position: { x: 700, y: 160 },
      data: {
        title: "Reuse or create?",
        reads: ["title", "summary", "key", "candidates"],
        writes: ["aspectId", "createNew", "confidence"],
        llm: {
          inputKeys: ["title", "summary", "key", "candidates"],
          outputSchema: ["aspectId", "createNew", "confidence"],
          instructions: [
            "You decide whether an existing Aspect already covers the proposal.",
            "Rules: prefer the smallest truthful existing Aspect; only create when none fit.",
            "If reusing: set createNew=false and aspectId to that candidate id.",
            "If creating: set createNew=true and aspectId to null (or empty string).",
            "confidence is 0-1. Do not invent ids that are not in candidates."
          ].join(" "),
          tools: []
        }
      }
    },
    {
      id: "route",
      type: "branch",
      position: { x: 920, y: 160 },
      data: {
        title: "Create new?",
        reads: ["createNew"],
        branch: { on: "createNew" }
      }
    },
    {
      id: "create",
      type: "write",
      position: { x: 1140, y: 40 },
      data: {
        title: "Create aspect",
        reads: ["title", "summary", "key", "reason", "parentAspectId"],
        writes: ["aspectId"],
        write: {
          action: "create_entity",
          argsFromBag: {
            title: "title",
            summary: "summary",
            key: "key",
            reason: "reason",
            parentAspectId: "parentAspectId"
          },
          defaults: { type: "aspect", status: "planned", resultAs: "aspectId" }
        }
      }
    },
    {
      id: "end_reuse",
      type: "end",
      position: { x: 1140, y: 280 },
      data: { title: "End (reused)" }
    },
    {
      id: "end_create",
      type: "end",
      position: { x: 1360, y: 40 },
      data: { title: "End (created)" }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "load", kind: "next" },
    { id: "e2", source: "load", target: "slim", kind: "next" },
    { id: "e3", source: "slim", target: "decide", kind: "next" },
    { id: "e4", source: "decide", target: "route", kind: "next" },
    { id: "e5", source: "route", target: "create", kind: "route", label: "true" },
    { id: "e6", source: "route", target: "end_reuse", kind: "route", label: "false" },
    { id: "e7", source: "create", target: "end_create", kind: "next" }
  ]
};

export const ensureAspectPreset: WorkflowPreset = {
  presetKey: "ensure_aspect",
  presetVersion: 3,
  title: "Ensure Aspect",
  summary: "Search for a similar Aspect before creating one; reuse when possible.",
  body: [
    "Call this workflow before create_entity for aspects.",
    "Inputs: title (required), summary, key, reason (required for create), parentAspectId (optional).",
    "Outputs: aspectId; createNew indicates whether a row was inserted.",
    "Prefer the smallest truthful existing Aspect; do not duplicate near-matches."
  ].join("\n"),
  status: "accepted",
  graph: ensureAspectGraph,
  supportsTargetSlug: "should-author-executable-workflow-step-graphs"
};

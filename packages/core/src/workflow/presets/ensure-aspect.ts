import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { WorkflowPreset } from "./types";

const STRING = { kind: "primitive" as const, type: "string" as const };
const BOOLEAN = { kind: "primitive" as const, type: "boolean" as const };
const NUMBER = { kind: "primitive" as const, type: "number" as const };
const ENTITY_ARRAY = { kind: "array" as const, items: { kind: "ref" as const, ref: "Entity" } };
const STRING_OR_NULL = {
  kind: "union" as const,
  options: [STRING, { kind: "primitive" as const, type: "null" as const }]
};

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
          title: { required: true, shape: STRING },
          summary: { required: false, shape: STRING },
          key: { required: false, shape: STRING },
          reason: { required: true, shape: STRING },
          parentAspectId: { required: false, shape: STRING }
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
        inputs: {
          title: { required: true, shape: STRING }
        },
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
          matches: { required: true, shape: ENTITY_ARRAY }
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
        inputs: {
          matches: { required: true, shape: ENTITY_ARRAY }
        },
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
        },
        outputContracts: {
          candidates: {
            required: true,
            shape: {
              kind: "array",
              items: {
                kind: "object",
                fields: {
                  id: STRING,
                  title: STRING,
                  status: STRING,
                  summary: STRING
                }
              }
            }
          }
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
        inputs: {
          title: { required: true, shape: STRING },
          summary: { required: false, shape: STRING },
          key: { required: false, shape: STRING },
          candidates: {
            required: true,
            shape: {
              kind: "array",
              items: {
                kind: "object",
                fields: {
                  id: STRING,
                  title: STRING,
                  status: STRING,
                  summary: STRING
                }
              }
            }
          }
        },
        writes: ["aspectId", "createNew", "confidence"],
        outputContracts: {
          aspectId: { required: false, shape: STRING_OR_NULL },
          createNew: { required: true, shape: BOOLEAN },
          confidence: { required: true, shape: NUMBER }
        },
        llm: {
          inputKeys: ["title", "summary", "key", "candidates"],
          outputSchema: ["aspectId", "createNew", "confidence"],
          instructions: [
            "You decide whether an existing Aspect already covers the proposal.",
            "Proposal title: {{title}}.",
            "Rules: prefer the smallest truthful existing Aspect; only create when none fit.",
            "If reusing: set createNew=false and aspectId to that candidate id.",
            "If creating: set createNew=true and aspectId to null (or empty string).",
            "confidence is 0-1. Do not invent ids that are not in candidates.",
            "Declared bag reads:",
            "{{@reads}}"
          ].join("\n"),
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
        inputs: {
          createNew: { required: true, shape: BOOLEAN }
        },
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
        inputs: {
          title: { required: true, shape: STRING },
          summary: { required: false, shape: STRING },
          key: { required: false, shape: STRING },
          reason: { required: true, shape: STRING },
          parentAspectId: { required: false, shape: STRING }
        },
        writes: ["aspectId"],
        outputContracts: {
          aspectId: { required: true, shape: STRING }
        },
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
  presetVersion: 5,
  title: "Ensure Aspect",
  summary: "Search for a similar Aspect before creating one; reuse when possible.",
  body: [
    "Call this workflow before create_entity for aspects.",
    "Inputs: title (required), summary, key, reason (required for create), parentAspectId (optional).",
    "Outputs: aspectId; createNew indicates whether a row was inserted.",
    "Prefer the smallest truthful existing Aspect; do not duplicate near-matches.",
    "Bag ports use inputs/outputContracts; aspectId is string|null from the LLM step."
  ].join("\n"),
  status: "accepted",
  graph: ensureAspectGraph,
  supportsTargetSlug: "should-author-executable-workflow-step-graphs"
};

import { WORKFLOW_SCHEMA_VERSION, type WorkflowGraph } from "../types";
import type { EntityType } from "../../domain/types";
import type { WorkflowPreset } from "./types";

export type MutationOp = "create" | "update" | "delete";

const CRUD_TYPES: EntityType[] = ["aspect", "feature", "task"];

/** Stable preset key: create_task, update_aspect, delete_feature, … */
export function presetKeyFor(op: MutationOp, type: EntityType): string {
  return `${op}_${type}`;
}

export function parseMutationPresetKey(
  presetKey: string
): { op: MutationOp; type: EntityType } | null {
  const match = /^(create|update|delete)_(aspect|feature|task)$/.exec(presetKey);
  if (!match) {
    return null;
  }
  return { op: match[1] as MutationOp, type: match[2] as EntityType };
}

export function listCrudPresetKeys(): string[] {
  const keys: string[] = [];
  for (const type of CRUD_TYPES) {
    for (const op of ["create", "update", "delete"] as MutationOp[]) {
      keys.push(presetKeyFor(op, type));
    }
  }
  return keys;
}

function skeletonCreateGraph(type: EntityType): WorkflowGraph {
  const resultKey = type === "task" ? "taskId" : type === "feature" ? "featureId" : "aspectId";
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 40, y: 120 },
        data: {
          title: "Start",
          writes: ["title", "summary", "key", "reason", "targetEntityId"],
          outputContracts: {
            title: { required: true, shape: { kind: "primitive", type: "string" } },
            reason: { required: true, shape: { kind: "primitive", type: "string" } }
          }
        }
      },
      {
        id: "create",
        type: "write",
        position: { x: 280, y: 120 },
        data: {
          title: `Create ${type}`,
          reads: ["title", "summary", "key", "reason", "targetEntityId"],
          writes: [resultKey],
          write: {
            action: "create_entity",
            argsFromBag: {
              title: "title",
              summary: "summary",
              key: "key",
              reason: "reason",
              parentAspectId: "targetEntityId"
            },
            defaults: { type, status: "planned", resultAs: resultKey }
          }
        }
      },
      {
        id: "end",
        type: "end",
        position: { x: 520, y: 120 },
        data: { title: "End" }
      }
    ],
    edges: [
      { id: "e1", source: "start", target: "create", kind: "next" },
      { id: "e2", source: "create", target: "end", kind: "next" }
    ]
  };
}

function skeletonUpdateGraph(type: EntityType): WorkflowGraph {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 40, y: 120 },
        data: {
          title: "Start",
          writes: ["id", "title", "summary", "status", "reason"],
          outputContracts: {
            id: { required: true, shape: { kind: "primitive", type: "string" } },
            reason: { required: true, shape: { kind: "primitive", type: "string" } }
          }
        }
      },
      {
        id: "update",
        type: "write",
        position: { x: 280, y: 120 },
        data: {
          title: `Update ${type}`,
          reads: ["id", "title", "summary", "status", "reason"],
          writes: ["entityId"],
          write: {
            action: "update_entity",
            argsFromBag: {
              id: "id",
              title: "title",
              summary: "summary",
              status: "status",
              reason: "reason"
            },
            defaults: { resultAs: "entityId" }
          }
        }
      },
      {
        id: "end",
        type: "end",
        position: { x: 520, y: 120 },
        data: { title: "End" }
      }
    ],
    edges: [
      { id: "e1", source: "start", target: "update", kind: "next" },
      { id: "e2", source: "update", target: "end", kind: "next" }
    ]
  };
}

/** Delete = archive (status archived). Never hard-deletes. */
function skeletonDeleteGraph(type: EntityType): WorkflowGraph {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 40, y: 120 },
        data: {
          title: "Start",
          writes: ["id", "reason"],
          outputContracts: {
            id: { required: true, shape: { kind: "primitive", type: "string" } },
            reason: { required: true, shape: { kind: "primitive", type: "string" } }
          }
        }
      },
      {
        id: "archive",
        type: "write",
        position: { x: 280, y: 120 },
        data: {
          title: `Archive ${type}`,
          reads: ["id", "reason"],
          writes: ["entityId"],
          write: {
            action: "update_entity",
            argsFromBag: {
              id: "id",
              reason: "reason"
            },
            defaults: { status: "archived", resultAs: "entityId" }
          }
        }
      },
      {
        id: "end",
        type: "end",
        position: { x: 520, y: 120 },
        data: { title: "End" }
      }
    ],
    edges: [
      { id: "e1", source: "start", target: "archive", kind: "next" },
      { id: "e2", source: "archive", target: "end", kind: "next" }
    ]
  };
}

function crudPreset(op: MutationOp, type: EntityType): WorkflowPreset {
  const presetKey = presetKeyFor(op, type);
  const title =
    op === "delete"
      ? `Archive ${type}`
      : `${op[0]!.toUpperCase()}${op.slice(1)} ${type}`;
  const graph =
    op === "create"
      ? skeletonCreateGraph(type)
      : op === "update"
        ? skeletonUpdateGraph(type)
        : skeletonDeleteGraph(type);

  const body =
    op === "delete"
      ? [
          `Archive a ${type} (status → archived). Does not hard-delete.`,
          "Bag: id (required), reason (required).",
          "Call via run_workflow with this presetKey instead of update_entity when this pack is seeded."
        ].join("\n")
      : op === "create"
        ? [
            `Create a ${type} entity.`,
            "Bag: title, reason (required); summary, key, targetEntityId optional.",
            type === "task"
              ? "Tasks should link to an Aspect/Feature (targetEntityId) when known."
              : "",
            "Prefer ensure_aspect before create_aspect when searching for reuse."
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `Update a ${type} entity.`,
            "Bag: id, reason (required); title, summary, status optional."
          ].join("\n");

  return {
    presetKey,
    presetVersion: 1,
    title,
    summary:
      op === "delete"
        ? `Archive ${type} via status=archived (no hard delete).`
        : `${title} through the workflow runner.`,
    body,
    status: "accepted",
    graph
  };
}

export function listCrudPresets(): WorkflowPreset[] {
  const presets: WorkflowPreset[] = [];
  for (const type of CRUD_TYPES) {
    for (const op of ["create", "update", "delete"] as MutationOp[]) {
      presets.push(crudPreset(op, type));
    }
  }
  return presets;
}

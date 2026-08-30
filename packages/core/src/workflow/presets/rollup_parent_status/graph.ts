import type { WorkflowGraph } from "../../graph";
import { WORKFLOW_SCHEMA_VERSION } from "../../nodes";
import { identityBindings } from "../bindings";

const STRING = { kind: "primitive" as const, type: "string" as const };

/**
 * Roll up parent process status from a changed Aspect/Feature/Task.
 * Decisions and questions never participate.
 */
export const rollupParentStatusGraph: WorkflowGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 40, y: 120 },
      data: {
        title: "Start",
        writes: ["entityId", "reason"],
        writeBindings: identityBindings(["entityId", "reason"]),
        outputContracts: {
          entityId: { required: true, shape: STRING },
          reason: { required: true, shape: STRING }
        }
      }
    },
    {
      id: "rollup",
      type: "write",
      position: { x: 280, y: 120 },
      data: {
        title: "Roll up parents",
        reads: ["entityId", "reason"],
        inputs: {
          entityId: { required: true, shape: STRING },
          reason: { required: true, shape: STRING }
        },
        inputBindings: identityBindings(["entityId", "reason"]),
        writes: ["updatedIds", "derived"],
        writeBindings: identityBindings(["updatedIds", "derived"]),
        outputContracts: {
          updatedIds: {
            required: true,
            shape: { kind: "array", items: STRING }
          },
          derived: { required: false, shape: { kind: "any" } }
        },
        write: {
          action: "rollup_parent_status",
          argsFromBag: {
            entityId: "entityId",
            reason: "reason"
          },
          defaults: { resultAs: "updatedIds" }
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
    { id: "e1", source: "start", target: "rollup", kind: "next" },
    { id: "e2", source: "rollup", target: "end", kind: "next" }
  ]
};


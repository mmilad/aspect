import { describe, expect, it } from "vitest";
import { createContextBag, WORKFLOW_SCHEMA_VERSION } from "./schema";
import { validateNodeInputs, validateNodeOutputs } from "./contracts";
import { nullable } from "./shapes";
import type { WorkflowNode } from "./types";

describe("node I/O contracts", () => {
  it("rejects null when input shape is non-null string", () => {
    const node: WorkflowNode = {
      id: "n",
      type: "tool",
      position: { x: 0, y: 0 },
      data: {
        title: "T",
        reads: ["taskId"],
        inputs: {
          taskId: { required: true, shape: { kind: "primitive", type: "string" } }
        },
        tool: { name: "x" }
      }
    };
    const bag = createContextBag({
      workflowId: "w",
      goal: "g",
      startNodeId: "n",
      keys: { taskId: null }
    });
    const result = validateNodeInputs(node, bag);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("taskId");
    }
  });

  it("accepts null when input shape is string|null", () => {
    const node: WorkflowNode = {
      id: "n",
      type: "tool",
      position: { x: 0, y: 0 },
      data: {
        title: "T",
        reads: ["taskId"],
        inputs: {
          taskId: { required: true, shape: nullable({ kind: "primitive", type: "string" }) }
        },
        tool: { name: "x" }
      }
    };
    const bag = createContextBag({
      workflowId: "w",
      goal: "g",
      startNodeId: "n",
      keys: { taskId: null }
    });
    expect(validateNodeInputs(node, bag).ok).toBe(true);
  });

  it("validates required outputs after writes", () => {
    const node: WorkflowNode = {
      id: "n",
      type: "transform",
      position: { x: 0, y: 0 },
      data: {
        title: "T",
        writes: ["id", "title"],
        outputContracts: {
          id: { required: true, shape: { kind: "primitive", type: "string" } },
          title: { required: true, shape: { kind: "primitive", type: "string" } }
        },
        auto: { assign: { set: {} } }
      }
    };
    const bag = createContextBag({
      workflowId: "w",
      goal: "g",
      startNodeId: "n",
      keys: { id: "a" }
    });
    const result = validateNodeOutputs(node, { ...bag, keys: { ...bag.keys, id: "a" } });
    expect(result.ok).toBe(false);
  });
});

// silence unused
void WORKFLOW_SCHEMA_VERSION;

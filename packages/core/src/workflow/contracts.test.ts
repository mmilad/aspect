import { describe, expect, it } from "vitest";
import { createContextBag } from "./schema";
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
        inputs: {
          taskId: { required: true, shape: nullable({ kind: "primitive", type: "string" }) }
        },
        inputBindings: { taskId: "taskId" },
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

  it("validates input port against bound bag key", () => {
    const node: WorkflowNode = {
      id: "n",
      type: "tool",
      position: { x: 0, y: 0 },
      data: {
        title: "T",
        inputs: {
          taskId: { required: true, shape: { kind: "primitive", type: "string" } }
        },
        inputBindings: { taskId: "selectedTask" },
        tool: { name: "x" }
      }
    };
    const missing = createContextBag({
      workflowId: "w",
      goal: "g",
      startNodeId: "n",
      keys: { taskId: "ignored" }
    });
    expect(validateNodeInputs(node, missing).ok).toBe(false);

    const ok = createContextBag({
      workflowId: "w",
      goal: "g",
      startNodeId: "n",
      keys: { selectedTask: "t1" }
    });
    expect(validateNodeInputs(node, ok).ok).toBe(true);
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
        writeBindings: { id: "id", title: "title" },
        auto: { assign: { set: {} } }
      }
    };
    const bag = createContextBag({
      workflowId: "w",
      goal: "g",
      startNodeId: "n",
      keys: { id: "a" }
    });
    const result = validateNodeOutputs(node, bag);
    expect(result.ok).toBe(false);
  });
});

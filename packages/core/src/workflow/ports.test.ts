import { describe, expect, it } from "vitest";
import {
  derivedReads,
  derivedWrites,
  normalizeNodePorts,
  resolveInputBindings,
  resolveWriteBindings
} from "./ports";
import type { WorkflowNode } from "./types";

function node(data: WorkflowNode["data"]): WorkflowNode {
  return { id: "n", type: "llm", position: { x: 0, y: 0 }, data };
}

describe("ports bindings", () => {
  it("uses identity when bindings omitted", () => {
    const n = node({
      title: "T",
      inputs: {
        brief: { required: true, shape: { kind: "primitive", type: "string" } }
      },
      outputContracts: {
        outline: { required: true, shape: { kind: "primitive", type: "string" } }
      }
    });
    expect(resolveInputBindings(n)).toEqual({ brief: "brief" });
    expect(resolveWriteBindings(n)).toEqual({ outline: "outline" });
    expect(derivedReads(n)).toEqual(["brief"]);
    expect(derivedWrites(n)).toEqual(["outline"]);
  });

  it("maps port to different bag key", () => {
    const n = node({
      title: "T",
      inputs: {
        taskId: { required: true, shape: { kind: "primitive", type: "string" } }
      },
      inputBindings: { taskId: "selectedTask" },
      outputContracts: {
        result: { required: true, shape: { kind: "primitive", type: "string" } }
      },
      writeBindings: { result: "aspectId" }
    });
    expect(resolveInputBindings(n).taskId).toBe("selectedTask");
    expect(derivedReads(n)).toEqual(["selectedTask"]);
    expect(derivedWrites(n)).toEqual(["aspectId"]);
  });

  it("normalizeNodePorts syncs reads/writes", () => {
    const data = normalizeNodePorts({
      title: "T",
      inputs: { a: { required: true, shape: { kind: "unknown" } } },
      inputBindings: { a: "bagA" },
      outputContracts: { b: { required: true, shape: { kind: "unknown" } } },
      writeBindings: { b: "bagB" }
    });
    expect(data.reads).toEqual(["bagA"]);
    expect(data.writes).toEqual(["bagB"]);
  });

  it("honors explicit empty writeBindings", () => {
    const n = node({
      title: "T",
      outputContracts: {
        outline: { required: true, shape: { kind: "primitive", type: "string" } }
      },
      writeBindings: {}
    });
    expect(resolveWriteBindings(n)).toEqual({});
    expect(derivedWrites(n)).toEqual([]);
  });
});

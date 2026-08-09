import { describe, expect, it } from "vitest";
import { resolveLlmOutputContracts } from "./llm-outputs";
import type { WorkflowNode } from "./types";

describe("resolveLlmOutputContracts", () => {
  it("defaults missing contracts to required string", () => {
    const node: WorkflowNode = {
      id: "llm1",
      type: "llm",
      position: { x: 0, y: 0 },
      data: {
        title: "Decide",
        writes: ["outline"],
        llm: { instructions: "x", outputSchema: ["outline"], tools: [] }
      }
    };
    const { keys, outputs } = resolveLlmOutputContracts(node);
    expect(keys).toEqual(["outline"]);
    expect(outputs.outline.shape).toEqual({ kind: "primitive", type: "string" });
    expect(outputs.outline.required).toBe(true);
  });

  it("uses outputContracts shapes when present", () => {
    const node: WorkflowNode = {
      id: "llm1",
      type: "llm",
      position: { x: 0, y: 0 },
      data: {
        title: "Decide",
        writes: ["score"],
        outputContracts: {
          score: { required: false, shape: { kind: "primitive", type: "number" } }
        },
        llm: { instructions: "x", outputSchema: ["score"], tools: [] }
      }
    };
    const { outputs } = resolveLlmOutputContracts(node);
    expect(outputs.score.shape).toEqual({ kind: "primitive", type: "number" });
    expect(outputs.score.required).toBe(false);
  });
});

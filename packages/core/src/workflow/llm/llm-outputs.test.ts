import { describe, expect, it } from "vitest";
import { resolveLlmOutputContracts } from "./llm-outputs";
import type { WorkflowNode } from "../nodes";

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

  it("inherits the selected JSON schema as the LLM output shape", () => {
    const node = {
      id: "llm",
      type: "llm" as const,
      position: { x: 0, y: 0 },
      data: {
        title: "LLM",
        outputContracts: { contextPack: { required: true } },
        llm: { schemaKey: "assistant_context_v2", outputSchema: ["contextPack"] }
      }
    };
    const resolved = resolveLlmOutputContracts(node).outputs.contextPack.shape;
    expect(resolved.kind).toBe("object");
    expect(resolved.kind === "object" ? Object.keys(resolved.fields) : []).toEqual([
      "summary", "topics", "questions", "context"
    ]);
  });

  it("keeps an explicit port contract instead of replacing it with the schema root", () => {
    const node = {
      id: "llm",
      type: "llm" as const,
      position: { x: 0, y: 0 },
      data: {
        title: "LLM",
        outputContracts: { analysis: { required: true, shape: { kind: "any" as const } } },
        llm: { schemaKey: "thought_analysis_v1", outputSchema: ["analysis"] }
      }
    };
    expect(resolveLlmOutputContracts(node).outputs.analysis.shape).toEqual({ kind: "any" });
  });
});

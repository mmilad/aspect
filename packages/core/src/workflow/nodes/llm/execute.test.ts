import { describe, expect, it } from "vitest";
import { WORKFLOW_IR_V1_KEY, WORKFLOW_IR_V1_SCHEMA } from "../../llm-json-schemas";
import { createContextBag, parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../../schema";
import { runWorkflowUntilPause } from "../../../generator/workflow/runtime/step";
import { parseLlmConfig } from "./schema";

const irGraph = {
  version: WORKFLOW_SCHEMA_VERSION,
  nodes: [
    {
      id: "start",
      type: "start" as const,
      position: { x: 0, y: 0 },
      data: { title: "Start", writes: ["goal"] }
    },
    {
      id: "draft",
      type: "llm" as const,
      position: { x: 200, y: 0 },
      data: {
        title: "Draft IR",
        writes: ["ir"],
        llm: {
          instructions: "Draft a tiny workflow IR.",
          schemaKey: WORKFLOW_IR_V1_KEY,
          outputSchema: ["ir"]
        }
      }
    },
    {
      id: "end",
      type: "end" as const,
      position: { x: 400, y: 0 },
      data: { title: "End" }
    }
  ],
  edges: [
    { id: "e1", source: "start", target: "draft", kind: "next" as const },
    { id: "e2", source: "draft", target: "end", kind: "next" as const }
  ]
};

describe("LLM node schemaKey", () => {
  it("parses schemaKey and defaults format to json_schema", () => {
    const errors: string[] = [];
    const llm = parseLlmConfig({ schemaKey: "workflow_ir_v1", instructions: "x" }, "n1", errors);
    expect(errors).toEqual([]);
    expect(llm?.schemaKey).toBe("workflow_ir_v1");
    expect(llm?.format).toBe("json_schema");
  });

  it("pauses with resolved jsonSchema from the catalog", async () => {
    const parsed = parseWorkflowGraph(irGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const bag = createContextBag({
      workflowId: "flow_ir",
      goal: "ir",
      startNodeId: "start",
      keys: { goal: "tiny" }
    });
    const paused = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(paused.kind).toBe("pending_llm");
    expect(paused.llm?.schemaKey).toBe(WORKFLOW_IR_V1_KEY);
    expect(paused.llm?.format).toBe("json_schema");
    expect(paused.llm?.jsonSchema).toEqual(WORKFLOW_IR_V1_SCHEMA);
    expect(paused.llm?.outputSchema).toEqual(["ir"]);
  });

  it("fails on unknown schemaKey", async () => {
    const parsed = parseWorkflowGraph({
      ...irGraph,
      nodes: irGraph.nodes.map((node) =>
        node.id === "draft"
          ? {
              ...node,
              data: {
                ...node.data,
                llm: { instructions: "x", schemaKey: "does_not_exist", outputSchema: ["ir"] }
              }
            }
          : node
      )
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const bag = createContextBag({
      workflowId: "flow_ir",
      goal: "ir",
      startNodeId: "start",
      keys: {}
    });
    const failed = await runWorkflowUntilPause({ graph: parsed.graph, bag });
    expect(failed.kind).toBe("failed");
    expect(failed.message).toMatch(/Unknown LLM JSON schema key/);
  });
});

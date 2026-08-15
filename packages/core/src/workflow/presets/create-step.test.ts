import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph, WORKFLOW_SCHEMA_VERSION } from "../schema";
import { WorkflowRun } from "../runtime/workflow";
import { createStepGraph, createStepPreset } from "./create-step";

const PLAN = {
  nodeType: "llm",
  title: "Writer",
  config: { instructions: "Return JSON." }
};

describe("create_step pin graph", () => {
  it("parses variables and data edges", () => {
    const parsed = parseWorkflowGraph(createStepGraph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.errors.join("\n"));
    }
    expect(parsed.graph.version).toBe(WORKFLOW_SCHEMA_VERSION);
    expect(parsed.graph.variables?.some((variable) => variable.name === "stepInstructions")).toBe(true);
    expect(parsed.graph.edges.some((edge) => edge.kind === "data")).toBe(true);
    expect(parsed.graph.nodes.find((node) => node.type === "start")?.data.outputContracts?.stepInstructions).toBeTruthy();
    expect(parsed.graph.nodes.find((node) => node.type === "end")?.data.inputs?.stepDraft).toBeTruthy();
  });

  it("runs Start input → LLM pause → output pin → factory → branch", async () => {
    const parsed = parseWorkflowGraph(createStepPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const run = new WorkflowRun({
      graph: parsed.graph,
      bag: createContextBag({
        workflowId: "create_step",
        goal: "unused",
        startNodeId: "start",
        keys: { stepInstructions: "Create an LLM writer node." }
      })
    });

    const paused = await run.runUntilPause();
    expect(paused.kind).toBe("pending_llm");
    expect(paused.nodeId).toBe("interpret_node_plan");
    expect(paused.llm?.reads.stepInstructions).toBe("Create an LLM writer node.");
    expect(paused.llm?.outputSchema).toContain("nodePlan");

    const afterLlm = await run.step({ llmWrites: { nodePlan: PLAN } });
    expect(afterLlm.kind).toBe("advanced");
    expect(run.bag.frame?.pins["interpret_node_plan::nodePlan"]).toEqual(PLAN);

    const afterFactory = await run.runUntilPause();
    expect(afterFactory.kind).toBe("pending_llm");
    expect(afterFactory.nodeId).toBe("verify_node");
    expect(afterFactory.llm?.reads.nodePlan).toEqual(PLAN);
    expect(afterFactory.llm?.reads.nodePlanValid).toBe(true);

    const done = await run.step({
      llmWrites: {
        nodeAccepted: true,
        qaReason: "Matches the requested LLM node.",
        repairInstructions: "",
        improvements: []
      }
    });
    expect(done.kind).toBe("advanced");
    const completed = await run.runUntilPause();
    expect(completed.kind).toBe("completed");
    expect(completed.bag.frame?.outputs.stepDraft).toBeTruthy();
    expect(completed.bag.keys.stepDraft).toBeTruthy();
  });
});

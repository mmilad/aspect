import { describe, expect, it } from "vitest";
import {
  createContextBag,
  emptyWorkflowGraph,
  pinKey,
  parseWorkflowGraph,
  WORKFLOW_SCHEMA_VERSION
} from "../schema";
import { validateValueAgainstShape } from "../shapes";
import { runWorkflowUntilPause, stepWorkflow } from "../../generator/workflow/runtime/step";
import { THOUGHT_ANALYSIS_V1_KEY, THOUGHT_ANALYSIS_V1_SCHEMA } from "../llm-json-schemas";
import { thinkingGraph, thinkingPreset } from "./thinking";

function trace(kind: string, nodeId: string, iteration: number) {
  return {
    id: `${kind}-${iteration}`,
    iteration,
    nodeId,
    kind,
    summary: `${kind} summary ${iteration}`,
    reason: `${kind} reason ${iteration}`,
    evidence: [`${kind} evidence`],
    confidence: 0.8,
    createdAt: `2026-08-26T00:00:0${iteration}.000Z`
  };
}

function decision(iteration: number, accepted = true) {
  return {
    result: { answer: `candidate-${iteration}` },
    decision: `candidate-${iteration}`,
    accepted,
    reason: `because-${iteration}`,
    evidence: ["analysis", "evaluation"],
    confidence: accepted ? 0.9 : 0.4,
    rejectedAlternatives: [{ alternative: "other", reason: "weaker" }],
    issues: accepted ? [] : ["needs revision"],
    nextAction: accepted ? "finalize" : "reflect"
  };
}

function validation(iteration: number, accepted: boolean) {
  return {
    accepted,
    reason: accepted ? "valid" : "not valid yet",
    issues: accepted ? [] : ["missing support"],
    confidence: accepted ? 0.92 : 0.3,
    recommendedAction: accepted ? "finalize" : "try again"
  };
}

function bag() {
  return createContextBag({
    workflowId: "thinking",
    goal: "choose a design",
    startNodeId: "start",
    keys: {
      task: "choose a design",
      context: { product: "planner" },
      constraints: ["small"],
      expectedOutput: { kind: "object", fields: { answer: { kind: "primitive", type: "string" } } },
      capabilities: [],
      maxIterations: 2
    }
  });
}

async function pauseAtNextLlm(inputBag = bag()) {
  const parsed = parseWorkflowGraph(thinkingGraph);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("thinkingGraph did not parse");
  }
  return runWorkflowUntilPause({ graph: parsed.graph, bag: inputBag, maxSteps: 20 });
}

async function completeLlm(currentBag: ReturnType<typeof bag>, nodeId: string, writes: Record<string, unknown>) {
  const parsed = parseWorkflowGraph(thinkingGraph);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("thinkingGraph did not parse");
  }
  const afterWrites = await stepWorkflow({ graph: parsed.graph, bag: currentBag, llmWrites: writes });
  expect(afterWrites.kind, `${nodeId}: ${afterWrites.message ?? ""}`).toBe("advanced");
  return runWorkflowUntilPause({ graph: parsed.graph, bag: afterWrites.bag, maxSteps: 20 });
}

async function runAttempt(currentBag: ReturnType<typeof bag>, iteration: number, accepted: boolean) {
  let paused = await completeLlm(currentBag, "understand", {
    analysis: { task: "choose", iteration },
    analysisTrace: trace("analysis", "understand", iteration)
  });
  expect(paused.kind).toBe("pending_llm");
  paused = await completeLlm(paused.bag, "generate_alternatives", {
    alternatives: [{ name: "a" }, { name: "b" }],
    alternativesTrace: trace("alternatives", "generate_alternatives", iteration)
  });
  expect(paused.kind).toBe("pending_llm");
  paused = await completeLlm(paused.bag, "evaluate", {
    evaluation: { best: "a", risks: [] },
    evaluationTrace: trace("evaluation", "evaluate", iteration)
  });
  expect(paused.kind).toBe("pending_llm");
  paused = await completeLlm(paused.bag, "decide", {
    decision: decision(iteration, accepted),
    decisionTrace: trace("decision", "decide", iteration)
  });
  expect(paused.kind).toBe("pending_llm");
  return completeLlm(paused.bag, "validate", {
    validation: validation(iteration, accepted),
    validationTrace: trace("validation", "validate", iteration)
  });
}

describe("thinking workflow preset", () => {
  it("parses and is registered as an accepted seeded preset", () => {
    const parsed = parseWorkflowGraph(thinkingPreset.graph);
    expect(parsed.ok).toBe(true);
    expect(thinkingPreset.presetKey).toBe("thinking");
    expect(thinkingPreset.status).toBe("accepted");
    const llmNodes = thinkingPreset.graph.nodes.filter((node) => node.type === "llm");
    expect(llmNodes).toHaveLength(7);
    expect(llmNodes.every((node) => node.data.llm?.schemaKey)).toBe(true);
  });

  it("pauses LLM steps with system prompt and resolved JSON schema preset", async () => {
    const paused = await pauseAtNextLlm();
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("understand");
    expect(paused.llm?.format).toBe("json_schema");
    expect(paused.llm?.schemaKey).toBe(THOUGHT_ANALYSIS_V1_KEY);
    expect(paused.llm?.jsonSchema).toEqual(THOUGHT_ANALYSIS_V1_SCHEMA);
    expect(paused.llm?.systemPrompt).toContain("Return only JSON");
    expect(paused.llm?.systemPrompt).toContain("Do not include private chain-of-thought");
  });

  it("successful path finalizes only after an accepted validation", async () => {
    let paused = await pauseAtNextLlm();
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("understand");

    paused = await runAttempt(paused.bag, 1, true);
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("finalize");

    const finalized = await stepWorkflow({
      graph: thinkingGraph,
      bag: paused.bag,
      llmWrites: { result: { answer: "candidate-1" }, iterations: 1 }
    });
    const done = await runWorkflowUntilPause({ graph: thinkingGraph, bag: finalized.bag });
    expect(done.kind).toBe("completed");
    expect(done.bag.keys.result).toEqual({ answer: "candidate-1" });
  });

  it("rejected validation reflects and returns to understand with previous attempt data", async () => {
    let paused = await pauseAtNextLlm();
    paused = await runAttempt(paused.bag, 1, false);
    expect(paused.kind).toBe("pending_llm");
    expect(paused.nodeId).toBe("reflect");

    paused = await completeLlm(paused.bag, "reflect", {
      reflection: {
        rejectedBecause: "missing support",
        wrongAssumption: "a was enough",
        nextChange: "use b evidence"
      },
      reflectionTrace: trace("reflection", "reflect", 1)
    });

    expect(paused.kind).toBe("pending_llm");
    expect(paused.nodeId).toBe("understand");
    expect(paused.llm?.reads).toHaveProperty("decision");
    expect(paused.llm?.reads).toHaveProperty("validation");
    expect(paused.llm?.reads).toHaveProperty("reflection");
    expect(paused.llm?.reads.trace).toHaveLength(6);
  });

  it("requires reason on decision and validation outputs", async () => {
    let paused = await pauseAtNextLlm();
    paused = await completeLlm(paused.bag, "understand", {
      analysis: {},
      analysisTrace: trace("analysis", "understand", 1)
    });
    paused = await completeLlm(paused.bag, "generate_alternatives", {
      alternatives: [],
      alternativesTrace: trace("alternatives", "generate_alternatives", 1)
    });
    paused = await completeLlm(paused.bag, "evaluate", {
      evaluation: {},
      evaluationTrace: trace("evaluation", "evaluate", 1)
    });

    const withoutReason = decision(1, true) as Record<string, unknown>;
    delete withoutReason.reason;
    const failed = await stepWorkflow({
      graph: thinkingGraph,
      bag: paused.bag,
      llmWrites: {
        decision: withoutReason,
        decisionTrace: trace("decision", "decide", 1)
      }
    });
    expect(failed.kind).toBe("failed");
    expect(failed.message).toContain("missing required field 'reason'");

    expect(validateValueAgainstShape({ accepted: true, issues: [], confidence: 0.5 }, thinkingGraph.nodes.find((node) => node.id === "validate")?.data.outputContracts?.validation.shape).ok).toBe(false);
  });

  it("keeps trace entries across iterations and fails cleanly at the iteration limit", async () => {
    const limitBag = createContextBag({
      workflowId: "thinking",
      goal: "choose",
      startNodeId: "start",
      keys: { ...bag().keys, maxIterations: 999 }
    });
    limitBag.frame = {
      inputs: { ...limitBag.keys, maxIterations: 1 },
      outputs: {},
      locals: {},
      pins: {},
      pinSeq: {},
      seq: 0
    };
    let paused = await pauseAtNextLlm(limitBag);
    paused = await runAttempt(paused.bag, 1, false);
    expect(paused.kind).toBe("pending_llm");
    paused = await completeLlm(paused.bag, "reflect", {
      reflection: { nextChange: "try again" },
      reflectionTrace: trace("reflection", "reflect", 1)
    });
    expect(paused.kind).toBe("failed");
    expect(paused.message).toContain("exceeded executionPolicy.maxVisits (1)");
    expect(paused.bag.frame?.pins[pinKey("trace_reflection", "trace")]).toHaveLength(6);
    expect(paused.bag.history?.filter((entry) => entry.nodeId === "understand")).toHaveLength(2);
  });

  it("rejects unbounded cycles and leaves acyclic workflows unchanged", () => {
    const cyclic = parseWorkflowGraph({
      version: WORKFLOW_SCHEMA_VERSION,
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: { title: "Start" } },
        {
          id: "loop",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { title: "Loop", writes: ["x"], auto: { assign: { set: { x: 1 } } } }
        },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: { title: "End" } }
      ],
      edges: [
        { id: "e1", source: "start", target: "loop", kind: "next" },
        { id: "e2", source: "loop", target: "loop", kind: "next" }
      ]
    });
    expect(cyclic.ok).toBe(false);
    if (!cyclic.ok) {
      expect(cyclic.errors.join("\n")).toContain("requires executionPolicy.maxVisits");
    }

    expect(parseWorkflowGraph(emptyWorkflowGraph()).ok).toBe(true);
  });
});

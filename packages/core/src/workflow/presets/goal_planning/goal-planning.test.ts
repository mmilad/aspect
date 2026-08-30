import { describe, expect, it } from "vitest";
import { createContextBag, parseWorkflowGraph } from "../../graph";
import { runWorkflowUntilPause, stepWorkflow } from "../../runtime";
import { PLAN_CLASSIFY_V1_KEY, PLAN_EXPAND_V1_KEY } from "../../../planning";
import type { PlanDocument } from "../../../planning";
import { PLAN_V1_DOCUMENT_KIND, validatePlanV1 } from "../../../planning";
import { THOUGHT_ANALYSIS_V1_KEY, THOUGHT_FINALIZE_V1_KEY } from "../../llm/llm-json-schemas";
import { PLAN_DOCUMENT_PERSIST_REASON } from "../../../planning";
import { goalPlanningGraph } from "./graph";
import { goalPlanningPreset } from "./preset";
import { thinkingGraph } from "../thinking/graph";
import { listParkedWorkflowPresets, listWorkflowPresets } from "../index";
import { getNodeModel } from "../../nodes";

function parsedGraph(raw: unknown) {
  const parsed = parseWorkflowGraph(raw);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("; "));
  }
  return parsed.graph;
}

const planningGraph = parsedGraph(goalPlanningGraph);
const thinkingChild = parsedGraph(thinkingGraph);

const adapters = {
  resolveSubworkflow: (workflowId: string) => (workflowId === "thinking" ? thinkingChild : null)
};

type PlanningAdapters = typeof adapters & {
  runWrite?: (call: { action: string; args: Record<string, unknown> }) => Promise<{ values: Record<string, unknown> }>;
};

function bag(overrides: Record<string, unknown> = {}) {
  return createContextBag({
    workflowId: "goal_planning",
    goal: "plan a product",
    startNodeId: "start",
    keys: {
      task: "Trading card register",
      constraints: ["mobile first"],
      context: { product: "cards" },
      success: "An inspectable plan.v1 spine.",
      ...overrides
    }
  });
}

function planOf(keys: Record<string, unknown>): PlanDocument {
  return keys.plan as PlanDocument;
}

async function pause(inputBag = bag(), runtime: PlanningAdapters = adapters) {
  return runWorkflowUntilPause({
    graph: planningGraph,
    bag: inputBag,
    adapters: runtime,
    maxSteps: 80
  });
}

async function completeLlm(
  currentBag: ReturnType<typeof bag>,
  writes: Record<string, unknown>,
  runtime: PlanningAdapters = adapters
) {
  const afterWrites = await stepWorkflow({
    graph: planningGraph,
    bag: currentBag,
    adapters: runtime,
    llmWrites: writes
  });
  if (
    afterWrites.kind === "pending_llm" ||
    afterWrites.kind === "pending_user" ||
    afterWrites.kind === "completed" ||
    afterWrites.kind === "failed"
  ) {
    return afterWrites;
  }
  expect(afterWrites.kind, afterWrites.message ?? "").toBe("advanced");
  return runWorkflowUntilPause({
    graph: planningGraph,
    bag: afterWrites.bag,
    adapters: runtime,
    maxSteps: 80
  });
}

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

async function completeThinkingAttempt(currentBag: ReturnType<typeof bag>, iteration = 1) {
  let paused = await completeLlm(currentBag, {
    analysis: { task: "choose", iteration },
    analysisTrace: trace("analysis", "understand", iteration)
  });
  expect(paused.kind, paused.message).toBe("pending_llm");
  paused = await completeLlm(paused.bag, {
    alternatives: [{ name: "import-first" }, { name: "camera-first" }],
    alternativesTrace: trace("alternatives", "generate_alternatives", iteration)
  });
  expect(paused.kind, paused.message).toBe("pending_llm");
  paused = await completeLlm(paused.bag, {
    evaluation: { best: "import-first", risks: [] },
    evaluationTrace: trace("evaluation", "evaluate", iteration)
  });
  expect(paused.kind, paused.message).toBe("pending_llm");
  paused = await completeLlm(paused.bag, {
    decision: {
      result: { chosen: "import-first", reason: "Register before hardware." },
      decision: "import-first",
      accepted: true,
      reason: "Capture can wait until the register exists.",
      evidence: ["brief"],
      confidence: 0.9,
      rejectedAlternatives: [{ alternative: "camera-first", reason: "hardware risk" }],
      issues: [],
      nextAction: "finalize"
    },
    decisionTrace: trace("decision", "decide", iteration)
  });
  expect(paused.kind, paused.message).toBe("pending_llm");
  return completeLlm(paused.bag, {
    validation: {
      accepted: true,
      reason: "valid",
      issues: [],
      confidence: 0.92,
      recommendedAction: "finalize"
    },
    validationTrace: trace("validation", "validate", iteration)
  });
}

const children = [
  {
    title: "Card capture",
    why: "Get cards into the register from camera or file.",
    suggestedType: "feature",
    dependsOn: []
  },
  {
    title: "Inventory browse",
    why: "Find owned cards after they are captured.",
    suggestedType: "feature",
    dependsOn: ["Card capture"]
  },
  {
    title: "Set identity",
    why: "Name which printing a card belongs to.",
    suggestedType: "feature",
    dependsOn: ["Card capture"]
  }
];

describe("goal_planning workflow preset", () => {
  it("parses as a seeded builder pack that must not drain LLM", async () => {
    const parsed = parseWorkflowGraph(goalPlanningPreset.graph);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("; ")).toBe(true);
    expect(goalPlanningPreset.presetKey).toBe("goal_planning");
    expect(goalPlanningPreset.kind).toBe("builder");
    expect(goalPlanningPreset.drainLlm).toBe(false);
    expect(listWorkflowPresets().some((preset) => preset.presetKey === "goal_planning")).toBe(true);
    expect(listParkedWorkflowPresets().some((preset) => preset.presetKey === "goal_planning")).toBe(false);
    const llmNodes = goalPlanningPreset.graph.nodes.filter((node) => node.type === "llm");
    expect(llmNodes.map((node) => node.id).sort()).toEqual(["classify", "expand"]);
    expect(llmNodes.every((node) => node.data.llm?.schemaKey)).toBe(true);
    expect(goalPlanningPreset.graph.nodes.some((node) => node.id === "think" && node.type === "subworkflow")).toBe(
      true
    );
    expect(goalPlanningPreset.graph.nodes.some((node) => node.id === "persist" && node.type === "write")).toBe(true);
    expect(goalPlanningPreset.graph.nodes.filter((node) => node.type === "branch")).toEqual([]);
    expect(
      goalPlanningPreset.graph.nodes
        .filter((node) => node.type === "switch")
        .map((node) => node.id)
        .sort()
    ).toEqual(["expand_branch", "persist_branch", "should_halt", "status_branch"]);
    expect(goalPlanningPreset.presetVersion).toBe(3);
    expect(goalPlanningPreset.status).toBe("accepted");
  });

  it("wires every exec edge to a pin that exists on the source and target", () => {
    const parsed = parseWorkflowGraph(goalPlanningPreset.graph);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error(parsed.errors.join("\n"));
    }
    for (const edge of parsed.graph.edges) {
      if (edge.kind === "data") {
        continue;
      }
      const source = parsed.graph.nodes.find((node) => node.id === edge.source);
      const target = parsed.graph.nodes.find((node) => node.id === edge.target);
      expect(source, edge.source).toBeTruthy();
      expect(target, edge.target).toBeTruthy();
      const sourcePins =
        getNodeModel(source!.type).execOutputs?.(source!) ??
        (source!.type === "end" || source!.type === "error_end" || source!.type === "get" ? [] : ["then"]);
      const targetPins = getNodeModel(target!.type).execInputs?.(target!) ?? (target!.type === "get" ? [] : ["in"]);
      const outPin = edge.sourcePin ?? "then";
      const inPin = edge.targetPin ?? "in";
      expect(sourcePins, `${edge.id} source ${outPin}`).toContain(outPin);
      expect(targetPins, `${edge.id} target ${inPin}`).toContain(inPin);
    }
  });

  it("pauses on classify with plan_classify_v1 after seeding the bag document", async () => {
    const paused = await pause();
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("classify");
    expect(paused.llm?.schemaKey).toBe(PLAN_CLASSIFY_V1_KEY);
    expect(paused.llm?.format).toBe("json_schema");
    const valid = validatePlanV1(paused.bag.keys.plan);
    expect(valid.ok).toBe(true);
    expect(paused.bag.keys.frontierId).toBeTruthy();
    expect(paused.llm?.instructions).toContain(String(paused.bag.keys.frontierId));
  });

  it("halts with frontier_empty when the root is classified atomic", async () => {
    const paused = await pause();
    const frontierId = String(paused.bag.keys.frontierId);
    const done = await completeLlm(paused.bag, {
      classify: {
        nodeId: frontierId,
        status: "atomic",
        reason: "The brief is already one leaf.",
        acceptance: ["One inspectable plan document exists"]
      }
    });
    expect(done.kind, done.message).toBe("completed");
    const plan = planOf(done.bag.keys);
    expect(plan.stop?.reason).toBe("frontier_empty");
    expect(validatePlanV1(plan).ok).toBe(true);
    expect(plan.todos[frontierId]?.status).toBe("atomic");
  });

  it("expands needs_subplan then classifies children until the frontier is empty", async () => {
    let paused = await pause();
    const rootId = String(paused.bag.keys.frontierId);
    paused = await completeLlm(paused.bag, {
      classify: {
        nodeId: rootId,
        status: "needs_subplan",
        reason: "Product-scale register needs a spine, not one leaf."
      }
    });
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("expand");
    expect(paused.llm?.schemaKey).toBe(PLAN_EXPAND_V1_KEY);

    paused = await completeLlm(paused.bag, { expand: { parentId: rootId, children } });
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("classify");

    while (paused.kind === "pending_llm" && paused.nodeId === "classify") {
      const frontierId = String(paused.bag.keys.frontierId);
      const title = planOf(paused.bag.keys).todos[frontierId]?.title ?? frontierId;
      paused = await completeLlm(paused.bag, {
        classify: {
          nodeId: frontierId,
          status: "atomic",
          reason: `${title} is a named spine leaf.`,
          acceptance: [`${title} stays a first-class node on the spine`]
        }
      });
    }

    expect(paused.kind, paused.message).toBe("completed");
    const plan = planOf(paused.bag.keys);
    expect(plan.stop?.reason).toBe("frontier_empty");
    expect(plan.todos[rootId]?.planId).toBeTruthy();
    expect(validatePlanV1(plan).ok).toBe(true);
    expect(plan.trace.some((entry) => entry.kind === "expand")).toBe(true);
    expect(plan.trace.some((entry) => entry.kind === "halt")).toBe(true);
  });

  it("nests Thinking on needs_decision and bubbles pending_llm to the parent run", async () => {
    let paused = await pause();
    const frontierId = String(paused.bag.keys.frontierId);
    const parentRunId = paused.bag.runId;
    paused = await completeLlm(paused.bag, {
      classify: {
        nodeId: frontierId,
        status: "needs_decision",
        reason: "Capture vs import-first is a product tradeoff."
      }
    });
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("think");
    expect(paused.llm?.schemaKey).toBe(THOUGHT_ANALYSIS_V1_KEY);
    expect(paused.llm?.nodeId).toBe("understand");
    expect(paused.bag.runId).toBe(parentRunId);
    expect(paused.bag.keys.thinkTask).toBeTruthy();

    paused = await completeThinkingAttempt(paused.bag);
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("think");
    expect(paused.llm?.schemaKey).toBe(THOUGHT_FINALIZE_V1_KEY);

    const done = await completeLlm(paused.bag, {
      result: { chosen: "import-first", reason: "Register before hardware." },
      iterations: 1
    });
    expect(done.kind, done.message).toBe("completed");
    expect(done.bag.runId).toBe(parentRunId);
    const plan = planOf(done.bag.keys);
    expect(plan.todos[frontierId]?.status).toBe("atomic");
    expect(Object.keys(plan.decisions)).toHaveLength(1);
    expect(plan.trace.some((entry) => entry.kind === "decide")).toBe(true);
    expect(plan.stop?.reason).toBe("frontier_empty");
    expect(validatePlanV1(plan).ok).toBe(true);
  });

  it("coerces expand parentId p_root instead of failing the run", async () => {
    let paused = await pause();
    const frontierId = String(paused.bag.keys.frontierId);
    paused = await completeLlm(paused.bag, {
      classify: {
        nodeId: frontierId,
        status: "needs_subplan",
        reason: "Product-scale register needs a spine, not one leaf."
      }
    });
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("expand");

    paused = await completeLlm(paused.bag, { expand: { parentId: "p_root", children } });
    expect(paused.kind, paused.message).not.toBe("failed");
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("classify");
    expect(validatePlanV1(planOf(paused.bag.keys)).ok).toBe(true);
    expect(planOf(paused.bag.keys).todos[frontierId]?.planId).toBeTruthy();
  });

  it("retries expand when children restate the parent instead of failing the run", async () => {
    let paused = await pause();
    const frontierId = String(paused.bag.keys.frontierId);
    const parentTitle = planOf(paused.bag.keys).todos[frontierId]?.title ?? "Trading card register";
    paused = await completeLlm(paused.bag, {
      classify: {
        nodeId: frontierId,
        status: "needs_subplan",
        reason: "Product-scale register needs a spine, not one leaf."
      }
    });
    expect(paused.nodeId).toBe("expand");

    paused = await completeLlm(paused.bag, {
      expand: {
        parentId: frontierId,
        children: [
          { title: `${parentTitle} with extras`, why: "Restates parent.", suggestedType: "feature", dependsOn: [] },
          children[1]!,
          children[2]!
        ]
      }
    });
    expect(paused.kind, paused.message).not.toBe("failed");
    expect(paused.kind, paused.message).toBe("pending_llm");
    expect(paused.nodeId).toBe("expand");
    expect(paused.bag.keys.applyError).toBeTruthy();
    expect(validatePlanV1(planOf(paused.bag.keys)).ok).toBe(true);
    expect(planOf(paused.bag.keys).todos[frontierId]?.planId).toBeNull();
  });

  it("halts on budget without an LLM turn when maxLlmTurns is already spent by seed", async () => {
    const done = await pause(bag({ budget: { maxDepth: 4, maxNodes: 48, maxLlmTurns: 1 } }));
    expect(done.kind, done.message).toBe("completed");
    expect(planOf(done.bag.keys).stop?.reason).toBe("budget");
    expect(done.bag.keys.planEntityId).toBeUndefined();
  });

  it("skips graph persist when targetTaskId is empty", async () => {
    const paused = await pause();
    const frontierId = String(paused.bag.keys.frontierId);
    const done = await completeLlm(paused.bag, {
      classify: {
        nodeId: frontierId,
        status: "atomic",
        reason: "The brief is already one leaf.",
        acceptance: ["One inspectable plan document exists"]
      }
    });
    expect(done.kind, done.message).toBe("completed");
    expect(done.bag.keys.planEntityId).toBeUndefined();
  });

  it("seals plan.v1 onto a Reference linked from targetTaskId on halt", async () => {
    const writes: Array<{ action: string; args: Record<string, unknown> }> = [];
    const runtime: PlanningAdapters = {
      ...adapters,
      runWrite: async (call) => {
        writes.push(call);
        return { values: { planEntityId: "reference_sealed" } };
      }
    };
    const paused = await pause(bag({ targetTaskId: "task_anchor" }), runtime);
    const frontierId = String(paused.bag.keys.frontierId);
    const done = await completeLlm(
      paused.bag,
      {
        classify: {
          nodeId: frontierId,
          status: "atomic",
          reason: "The brief is already one leaf.",
          acceptance: ["One inspectable plan document exists"]
        }
      },
      runtime
    );
    expect(done.kind, done.message).toBe("completed");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.action).toBe("create_entity");
    expect(writes[0]?.args.type).toBe("reference");
    expect(writes[0]?.args.kind).toBe(PLAN_V1_DOCUMENT_KIND);
    expect(writes[0]?.args.linkFrom).toBe("task_anchor");
    expect(writes[0]?.args.linkType).toBe("references");
    expect(writes[0]?.args.reason).toBe(PLAN_DOCUMENT_PERSIST_REASON);
    expect((writes[0]?.args.document as PlanDocument | undefined)?.schema).toBe("projectplaner.plan.v1");
    expect(done.bag.keys.planEntityId).toBe("reference_sealed");
  });
});

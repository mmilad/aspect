import { describe, expect, it } from "vitest";
import {
  applyPlanClassify,
  applyPlanDecide,
  applyPlanExpand,
  haltPlanDocument,
  pickPlanFrontier,
  planDocumentPersistRoute,
  planDocumentTitle,
  prepareThinkingInputs,
  resolvePlanTodoId,
  seedRootPlan
} from "./plan-v1-apply";
import { PLAN_V1_SCHEMA_NAME, suggestPlanStop, validatePlanV1 } from "./plan-v1";
import type { PlanExpandChild } from "./plan-v1-writes";

const brief = {
  task: "Trading card register",
  success: "A inspectable spine for capture, inventory, and identity.",
  constraints: ["mobile"],
  context: { product: "cards" }
};

const children: PlanExpandChild[] = [
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

describe("plan.v1 apply helpers", () => {
  it("seeds a valid root document and picks the unclassified root todo", () => {
    const plan = seedRootPlan(brief);
    const valid = validatePlanV1(plan);
    expect(valid.ok).toBe(true);
    expect(plan.schema).toBe(PLAN_V1_SCHEMA_NAME);
    const frontier = pickPlanFrontier(plan);
    expect(frontier).toBeTruthy();
    expect(plan.todos[frontier!]?.status).toBe("needs_subplan");
    expect(plan.todos[frontier!]?.planId).toBeNull();
  });

  it("applies atomic classify and then has an empty frontier", () => {
    const seeded = seedRootPlan(brief);
    const todoId = pickPlanFrontier(seeded)!;
    const classified = applyPlanClassify(seeded, {
      nodeId: todoId,
      status: "atomic",
      reason: "The brief is already a single leaf.",
      acceptance: ["One inspectable plan document exists"]
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) {
      return;
    }
    expect(pickPlanFrontier(classified.plan)).toBeNull();
    expect(suggestPlanStop(classified.plan).reason).toBe("frontier_empty");
  });

  it("records an open question and skips that todo on the next pick", () => {
    const seeded = seedRootPlan(brief);
    const todoId = pickPlanFrontier(seeded)!;
    const classified = applyPlanClassify(seeded, {
      nodeId: todoId,
      status: "needs_question",
      reason: "Commerce vs owned-catalog is a fact.",
      question: { kind: "scope", text: "Is buying or selling cards in v1?" }
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) {
      return;
    }
    expect(Object.keys(classified.plan.questions)).toHaveLength(1);
    expect(pickPlanFrontier(classified.plan)).toBeNull();
    expect(suggestPlanStop(classified.plan).reason).toBe("needs_user");
  });

  it("expands a needs_subplan todo into 3–8 children and picks a child next", () => {
    const seeded = seedRootPlan(brief);
    const parentId = pickPlanFrontier(seeded)!;
    const expanded = applyPlanExpand(seeded, { parentId, children });
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) {
      return;
    }
    const parent = expanded.plan.todos[parentId];
    expect(parent?.planId).toBeTruthy();
    const childId = pickPlanFrontier(expanded.plan);
    expect(childId).toBeTruthy();
    expect(childId).not.toBe(parentId);
    expect(expanded.plan.todos[childId!]?.title).toBe("Card capture");
    const captureTask = Object.values(expanded.plan.tasks).find((task) => task.title === "Inventory browse");
    expect(captureTask?.dependsOn.length).toBe(1);
  });

  it("treats an expanded parent as settled once children are leaves", () => {
    const seeded = seedRootPlan(brief);
    const parentId = pickPlanFrontier(seeded)!;
    const expanded = applyPlanExpand(seeded, { parentId, children });
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) {
      return;
    }
    let plan = expanded.plan;
    for (const todo of Object.values(plan.todos)) {
      if (todo.id === parentId) {
        continue;
      }
      const classified = applyPlanClassify(plan, {
        nodeId: todo.id,
        status: "atomic",
        reason: "Named spine leaf.",
        acceptance: [`${todo.title} is inspectable`]
      });
      expect(classified.ok).toBe(true);
      if (!classified.ok) {
        return;
      }
      plan = classified.plan;
    }
    expect(pickPlanFrontier(plan)).toBeNull();
    expect(suggestPlanStop(plan).reason).toBe("frontier_empty");
  });

  it("rejects an expand that restates the parent title", () => {
    const seeded = seedRootPlan(brief);
    const parentId = pickPlanFrontier(seeded)!;
    const result = applyPlanExpand(seeded, {
      parentId,
      children: [
        { title: brief.task, why: "Same as parent.", suggestedType: "feature", dependsOn: [] },
        children[1]!,
        children[2]!
      ]
    });
    expect(result.ok).toBe(false);
  });

  it("coerces expand parentId p_root to the frontier todo", () => {
    const seeded = seedRootPlan(brief);
    const todoId = pickPlanFrontier(seeded)!;
    expect(resolvePlanTodoId(seeded, "p_root", todoId)).toBe(todoId);
    const expanded = applyPlanExpand(seeded, { parentId: "p_root", children }, todoId);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) {
      return;
    }
    expect(expanded.plan.todos[todoId]?.planId).toBeTruthy();
  });

  it("halts pick when plan depth has reached maxDepth", () => {
    const seeded = seedRootPlan(brief, { maxDepth: 1 });
    const parentId = pickPlanFrontier(seeded)!;
    const expanded = applyPlanExpand(seeded, { parentId, children });
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) {
      return;
    }
    expect(pickPlanFrontier(expanded.plan)).toBeNull();
    expect(suggestPlanStop(expanded.plan).reason).toBe("budget");
  });

  it("halts with a stop object on the document", () => {
    const seeded = seedRootPlan(brief, { maxLlmTurns: 1 });
    expect(pickPlanFrontier(seeded)).toBeNull();
    const halted = haltPlanDocument(seeded);
    expect(halted.stop.reason).toBe("budget");
    expect(halted.plan.stop?.reason).toBe("budget");
  });

  it("persist route is skip without a task id", () => {
    expect(planDocumentPersistRoute(undefined)).toBe("skip");
    expect(planDocumentPersistRoute("")).toBe("skip");
    expect(planDocumentPersistRoute("  ")).toBe("skip");
    expect(planDocumentPersistRoute("task_abc")).toBe("persist");
  });

  it("plan document title prefers the root plan title", () => {
    const seeded = seedRootPlan(brief);
    expect(planDocumentTitle(seeded)).toBe(seeded.plans[seeded.rootId]!.title);
  });

  it("records an accepted Thinking decision as an atomic leaf", () => {
    const seeded = seedRootPlan(brief);
    const todoId = pickPlanFrontier(seeded)!;
    const classified = applyPlanClassify(seeded, {
      nodeId: todoId,
      status: "needs_decision",
      reason: "Capture vs import-first is a product tradeoff."
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) {
      return;
    }
    const prepared = prepareThinkingInputs(classified.plan, todoId);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    expect(prepared.values.thinkTask).toContain("Decide:");
    const decided = applyPlanDecide(classified.plan, {
      nodeId: todoId,
      thought: {
        decision: "import-first",
        accepted: true,
        reason: "Capture can wait until the register exists.",
        evidence: ["brief"],
        confidence: 0.8,
        rejectedAlternatives: [{ alternative: "camera-first", reason: "hardware risk" }],
        result: { chosen: "import-first" }
      }
    });
    expect(decided.ok).toBe(true);
    if (!decided.ok) {
      return;
    }
    expect(decided.plan.todos[todoId]?.status).toBe("atomic");
    expect(Object.keys(decided.plan.decisions)).toHaveLength(1);
    expect(pickPlanFrontier(decided.plan)).toBeNull();
    expect(suggestPlanStop(decided.plan).reason).toBe("frontier_empty");
  });
});

import { describe, expect, it } from "vitest";
import {
  PLAN_V1_KEY,
  PLAN_V1_SCHEMA,
  PLAN_V1_SCHEMA_NAME,
  TRADING_CARD_SPINE_PLAN,
  leafTodoIds,
  openQuestionIds,
  planMaxDepth,
  planTodoIsLeaf,
  suggestPlanStop,
  validatePlanV1
} from "./plan-v1";
import { getLlmJsonSchemaPreset } from "./llm-json-schemas";

describe("plan_v1", () => {
  it("is registered as an llm_json_schemas preset", () => {
    expect(getLlmJsonSchemaPreset(PLAN_V1_KEY)?.schema).toEqual(PLAN_V1_SCHEMA);
    expect(PLAN_V1_SCHEMA.$id).toBe("projectplaner:llm-json-schema:plan_v1");
  });

  it("validates the trading-card spine example", () => {
    const result = validatePlanV1(TRADING_CARD_SPINE_PLAN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.schema).toBe(PLAN_V1_SCHEMA_NAME);
      expect(result.plan.rootId).toBe("p_root");
      expect(Object.keys(result.plan.plans)).toEqual(["p_root", "p_collection"]);
      expect(result.plan.plans.p_collection?.taskIds).toEqual([]);
      expect(result.plan.todos.td_collection?.status).toBe("needs_subplan");
      expect(result.plan.todos.td_collection?.planId).toBe("p_collection");
      expect(result.plan.todos.td_visual?.status).toBe("atomic");
      expect(result.plan.stop).toBeNull();
    }
  });

  it("rejects extra fields on plan items and child plans on non-subplan todos", () => {
    expect(
      validatePlanV1({
        ...TRADING_CARD_SPINE_PLAN,
        plans: {
          ...TRADING_CARD_SPINE_PLAN.plans,
          p_root: { ...TRADING_CARD_SPINE_PLAN.plans.p_root, extra: true }
        }
      }).ok
    ).toBe(false);

    expect(
      validatePlanV1({
        ...TRADING_CARD_SPINE_PLAN,
        todos: {
          ...TRADING_CARD_SPINE_PLAN.todos,
          td_visual: { ...TRADING_CARD_SPINE_PLAN.todos.td_visual, planId: "p_collection" }
        }
      }).ok
    ).toBe(false);
  });

  it("treats atomic todos with acceptance and no open questions as leaves", () => {
    const visual = TRADING_CARD_SPINE_PLAN.todos.td_visual!;
    const store = TRADING_CARD_SPINE_PLAN.todos.td_store!;
    expect(planTodoIsLeaf(visual, TRADING_CARD_SPINE_PLAN.questions)).toBe(true);
    expect(planTodoIsLeaf(store, TRADING_CARD_SPINE_PLAN.questions)).toBe(false);
    expect(leafTodoIds(TRADING_CARD_SPINE_PLAN)).toEqual(["td_visual"]);
    expect(openQuestionIds(TRADING_CARD_SPINE_PLAN)).toEqual(["q_commerce", "q_platforms"]);
  });

  it("does not halt the spine example: decisions and a subplan remain", () => {
    const stop = suggestPlanStop(TRADING_CARD_SPINE_PLAN);
    expect(stop.reason).toBe("needs_user");
    expect(stop.leafIds).toEqual(["td_visual"]);
    expect(stop.remainingQuestionIds).toContain("q_commerce");
    expect(planMaxDepth(TRADING_CARD_SPINE_PLAN)).toBe(1);
  });

  it("halts needs_user when only open questions remain", () => {
    const plan = {
      ...TRADING_CARD_SPINE_PLAN,
      todos: {
        td_store: TRADING_CARD_SPINE_PLAN.todos.td_store!,
        td_sync: TRADING_CARD_SPINE_PLAN.todos.td_sync!,
        td_visual: TRADING_CARD_SPINE_PLAN.todos.td_visual!
      }
    };
    expect(suggestPlanStop(plan).reason).toBe("needs_user");
    expect(suggestPlanStop(plan).message).toMatch(/open questions/i);
  });

  it("halts frontier_empty when every active todo is a leaf", () => {
    const plan = {
      ...TRADING_CARD_SPINE_PLAN,
      questions: {
        q_commerce: { ...TRADING_CARD_SPINE_PLAN.questions.q_commerce!, status: "answered" as const },
        q_platforms: { ...TRADING_CARD_SPINE_PLAN.questions.q_platforms!, status: "answered" as const }
      },
      todos: {
        td_visual: TRADING_CARD_SPINE_PLAN.todos.td_visual!
      }
    };
    expect(suggestPlanStop(plan).reason).toBe("frontier_empty");
  });

  it("halts budget when node count exceeds maxNodes", () => {
    const plan = {
      ...TRADING_CARD_SPINE_PLAN,
      budget: { ...TRADING_CARD_SPINE_PLAN.budget, maxNodes: 2 }
    };
    expect(suggestPlanStop(plan).reason).toBe("budget");
  });
});

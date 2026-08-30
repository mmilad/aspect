import { describe, expect, it } from "vitest";
import { getLlmJsonSchemaPreset } from "../workflow/llm/llm-json-schemas";
import {
  PLAN_CLASSIFY_V1_KEY,
  PLAN_CLASSIFY_V1_SCHEMA,
  PLAN_EXPAND_V1_KEY,
  PLAN_EXPAND_V1_SCHEMA,
  assertExpandChildren,
  validatePlanClassify,
  validatePlanExpand,
  type PlanExpandChild
} from "./plan-v1-writes";

const threeChildren: PlanExpandChild[] = [
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

describe("plan classify/expand writes", () => {
  it("registers both schemas in the llm_json_schemas catalog", () => {
    expect(getLlmJsonSchemaPreset(PLAN_CLASSIFY_V1_KEY)?.schema).toEqual(PLAN_CLASSIFY_V1_SCHEMA);
    expect(getLlmJsonSchemaPreset(PLAN_EXPAND_V1_KEY)?.schema).toEqual(PLAN_EXPAND_V1_SCHEMA);
  });

  it("accepts a valid classify of an atomic leaf", () => {
    const result = validatePlanClassify({
      nodeId: "td_visual",
      status: "atomic",
      reason: "Look-and-feel is already a named spine node.",
      acceptance: ["Visual system stays a first-class aspect on the spine"]
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid classify that opens a question", () => {
    const result = validatePlanClassify({
      nodeId: "td_store",
      status: "needs_question",
      reason: "Commerce vs owned-catalog is a fact, not a subplan.",
      question: { kind: "scope", text: "Is buying or selling cards in v1?" }
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an invalid classify status", () => {
    const result = validatePlanClassify({
      nodeId: "td_visual",
      status: "maybe",
      reason: "not a status"
    });
    expect(result.ok).toBe(false);
  });

  it("rejects atomic without acceptance and needs_question without question", () => {
    expect(
      validatePlanClassify({
        nodeId: "td_visual",
        status: "atomic",
        reason: "no acceptance"
      }).ok
    ).toBe(false);
    expect(
      validatePlanClassify({
        nodeId: "td_store",
        status: "needs_question",
        reason: "no question body"
      }).ok
    ).toBe(false);
  });

  it("accepts a valid 3-child expand of td_collection", () => {
    const result = validatePlanExpand({
      parentId: "td_collection",
      children: threeChildren
    });
    expect(result.ok).toBe(true);
    expect(assertExpandChildren("Collection register", threeChildren).ok).toBe(true);
  });

  it("rejects too few or too many expand children", () => {
    expect(
      validatePlanExpand({
        parentId: "td_collection",
        children: threeChildren.slice(0, 2)
      }).ok
    ).toBe(false);
    expect(
      validatePlanExpand({
        parentId: "td_collection",
        children: [...threeChildren, ...threeChildren, ...threeChildren]
      }).ok
    ).toBe(false);
  });

  it("rejects a child title that restates the parent", () => {
    const restated: PlanExpandChild[] = [
      {
        title: "Collection register",
        why: "Same as parent.",
        suggestedType: "aspect",
        dependsOn: []
      },
      threeChildren[1]!,
      threeChildren[2]!
    ];
    const result = assertExpandChildren("Collection register", restated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => /restates parent/i.test(error))).toBe(true);
    }
  });

  it("rejects a child title that contains the parent title", () => {
    const restated: PlanExpandChild[] = [
      {
        title: "Collection register with pagination",
        why: "Parent plus a qualifier.",
        suggestedType: "feature",
        dependsOn: []
      },
      threeChildren[1]!,
      threeChildren[2]!
    ];
    const result = assertExpandChildren("Collection register", restated);
    expect(result.ok).toBe(false);
  });
});

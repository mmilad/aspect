import { validateJsonSchema } from "./json-schema-validate";
import {
  PLAN_TODO_STATUSES,
  type PlanQuestionKind,
  type PlanSuggestedType,
  type PlanTodoStatus
} from "./plan-v1";

export const PLAN_CLASSIFY_V1_KEY = "plan_classify_v1";
export const PLAN_EXPAND_V1_KEY = "plan_expand_v1";

const STRING = { type: "string", minLength: 1 };
const STRING_ARRAY = { type: "array", items: STRING };

export type PlanClassifyQuestion = {
  kind: PlanQuestionKind;
  text: string;
};

export type PlanClassifyWrite = {
  nodeId: string;
  status: PlanTodoStatus;
  reason: string;
  acceptance?: string[];
  question?: PlanClassifyQuestion;
};

export type PlanExpandChild = {
  title: string;
  why: string;
  suggestedType: PlanSuggestedType;
  dependsOn: string[];
};

export type PlanExpandWrite = {
  parentId: string;
  children: PlanExpandChild[];
};

const CLASSIFY_QUESTION = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text"],
  properties: {
    kind: { type: "string", enum: ["missing_fact", "scope", "tradeoff"] },
    text: STRING
  }
};

export const PLAN_CLASSIFY_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:plan_classify_v1",
  type: "object",
  additionalProperties: false,
  required: ["nodeId", "status", "reason"],
  properties: {
    nodeId: STRING,
    status: { type: "string", enum: [...PLAN_TODO_STATUSES] },
    reason: STRING,
    acceptance: { type: "array", items: STRING },
    question: CLASSIFY_QUESTION
  },
  if: {
    properties: { status: { const: "atomic" } },
    required: ["status"]
  },
  then: {
    required: ["acceptance"],
    properties: {
      acceptance: { type: "array", minItems: 1, items: STRING }
    }
  },
  else: {
    if: {
      properties: { status: { const: "needs_question" } },
      required: ["status"]
    },
    then: {
      required: ["question"],
      properties: { question: CLASSIFY_QUESTION }
    }
  }
};

const EXPAND_CHILD = {
  type: "object",
  additionalProperties: false,
  required: ["title", "why", "suggestedType", "dependsOn"],
  properties: {
    title: STRING,
    why: STRING,
    suggestedType: { type: "string", enum: ["aspect", "feature", "task"] },
    dependsOn: STRING_ARRAY
  }
};

export const PLAN_EXPAND_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:plan_expand_v1",
  type: "object",
  additionalProperties: false,
  required: ["parentId", "children"],
  properties: {
    parentId: STRING,
    children: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: EXPAND_CHILD
    }
  }
};

export function validatePlanClassify(
  value: unknown
): { ok: true; write: PlanClassifyWrite } | { ok: false; errors: string[] } {
  const errors = validateJsonSchema(PLAN_CLASSIFY_V1_SCHEMA, value);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, write: value as PlanClassifyWrite };
}

export function validatePlanExpand(
  value: unknown
): { ok: true; write: PlanExpandWrite } | { ok: false; errors: string[] } {
  const errors = validateJsonSchema(PLAN_EXPAND_V1_SCHEMA, value);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, write: value as PlanExpandWrite };
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function assertExpandChildren(
  parentTitle: string,
  children: PlanExpandChild[]
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (children.length < 3) {
    errors.push("expand requires at least 3 children");
  }
  if (children.length > 8) {
    errors.push("expand allows at most 8 children");
  }
  const parent = normalizeTitle(parentTitle);
  const seen = new Set<string>();
  for (const child of children) {
    const title = normalizeTitle(child.title);
    if (title === parent || (parent.length > 0 && title.includes(parent))) {
      errors.push(`child title restates parent: ${child.title}`);
    }
    if (seen.has(title)) {
      errors.push(`duplicate child title: ${child.title}`);
    }
    seen.add(title);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

import { validateJsonSchema } from "./json-schema-validate";

export const PLAN_V1_KEY = "plan_v1";
export const PLAN_V1_SCHEMA_NAME = "projectplaner.plan.v1";
/** Graph Reference metadata.kind for a sealed plan.v1 document (not an orientation packet). */
export const PLAN_V1_DOCUMENT_KIND = "plan.v1";

export const PLAN_V1_DEFAULT_BUDGET = {
  maxDepth: 4,
  maxNodes: 48,
  maxLlmTurns: 24
} as const;

export const PLAN_TODO_STATUSES = [
  "atomic",
  "needs_question",
  "needs_decision",
  "needs_subplan",
  "dropped"
] as const;

export type PlanTodoStatus = (typeof PLAN_TODO_STATUSES)[number];
export type PlanSuggestedType = "aspect" | "feature" | "task";
export type PlanQuestionKind = "missing_fact" | "scope" | "tradeoff";
export type PlanHaltReason = "frontier_empty" | "needs_user" | "budget";
export type PlanTraceKind = "classify" | "expand" | "decide" | "halt";

export type PlanBudget = {
  maxDepth: number;
  maxNodes: number;
  maxLlmTurns: number;
};

export type PlanBrief = {
  task: string;
  constraints: string[];
  context: Record<string, unknown>;
  success: string;
};

export type PlanRecord = {
  id: string;
  title: string;
  parentId: string | null;
  dependsOn: string[];
  taskIds: string[];
  why: string;
};

export type PlanTask = {
  id: string;
  planId: string;
  title: string;
  description: string;
  dependsOn: string[];
  todoIds: string[];
  suggestedType: PlanSuggestedType;
};

export type PlanTodo = {
  id: string;
  taskId: string;
  title: string;
  status: PlanTodoStatus;
  acceptance: string[];
  questionIds: string[];
  decisionIds: string[];
  planId: string | null;
};

export type PlanQuestion = {
  id: string;
  nodeId: string;
  kind: PlanQuestionKind;
  text: string;
  blocks: string[];
  status: "open" | "answered";
};

export type PlanDecisionAlternative = {
  option: string;
  rejectedBecause: string;
};

export type PlanDecision = {
  id: string;
  nodeId: string;
  question: string;
  chosen: string;
  alternatives: PlanDecisionAlternative[];
  reason: string;
  evidence: string[];
  confidence: number;
  status: "accepted" | "rejected";
};

export type PlanTraceEntry = {
  id: string;
  iteration: number;
  nodeId: string;
  kind: PlanTraceKind;
  summary: string;
  reason: string;
  evidence: string[];
  confidence: number;
};

export type PlanStop = {
  reason: PlanHaltReason;
  remainingQuestionIds: string[];
  leafIds: string[];
  message: string;
};

export type PlanDocument = {
  schema: typeof PLAN_V1_SCHEMA_NAME;
  brief: PlanBrief;
  budget: PlanBudget;
  rootId: string;
  plans: Record<string, PlanRecord>;
  tasks: Record<string, PlanTask>;
  todos: Record<string, PlanTodo>;
  questions: Record<string, PlanQuestion>;
  decisions: Record<string, PlanDecision>;
  trace: PlanTraceEntry[];
  stop: PlanStop | null;
};

const STRING = { type: "string", minLength: 1 };
const STRING_ARRAY = { type: "array", items: STRING };
const CONFIDENCE = { type: "number", minimum: 0, maximum: 1 };
const ID_ARRAY = STRING_ARRAY;

const PLAN_DEF = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "parentId", "dependsOn", "taskIds", "why"],
  properties: {
    id: STRING,
    title: STRING,
    parentId: { type: ["string", "null"] },
    dependsOn: ID_ARRAY,
    taskIds: ID_ARRAY,
    why: STRING
  }
};

const TASK_DEF = {
  type: "object",
  additionalProperties: false,
  required: ["id", "planId", "title", "description", "dependsOn", "todoIds", "suggestedType"],
  properties: {
    id: STRING,
    planId: STRING,
    title: STRING,
    description: STRING,
    dependsOn: ID_ARRAY,
    todoIds: ID_ARRAY,
    suggestedType: { type: "string", enum: ["aspect", "feature", "task"] }
  }
};

const TODO_DEF = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "taskId",
    "title",
    "status",
    "acceptance",
    "questionIds",
    "decisionIds",
    "planId"
  ],
  properties: {
    id: STRING,
    taskId: STRING,
    title: STRING,
    status: { type: "string", enum: [...PLAN_TODO_STATUSES] },
    acceptance: STRING_ARRAY,
    questionIds: ID_ARRAY,
    decisionIds: ID_ARRAY,
    planId: { type: ["string", "null"] }
  },
  if: {
    properties: { status: { const: "needs_subplan" } },
    required: ["status"]
  },
  then: {},
  else: {
    properties: { planId: { type: "null" } }
  }
};

const QUESTION_DEF = {
  type: "object",
  additionalProperties: false,
  required: ["id", "nodeId", "kind", "text", "blocks", "status"],
  properties: {
    id: STRING,
    nodeId: STRING,
    kind: { type: "string", enum: ["missing_fact", "scope", "tradeoff"] },
    text: STRING,
    blocks: ID_ARRAY,
    status: { type: "string", enum: ["open", "answered"] }
  }
};

const DECISION_DEF = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "nodeId",
    "question",
    "chosen",
    "alternatives",
    "reason",
    "evidence",
    "confidence",
    "status"
  ],
  properties: {
    id: STRING,
    nodeId: STRING,
    question: STRING,
    chosen: STRING,
    alternatives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["option", "rejectedBecause"],
        properties: {
          option: STRING,
          rejectedBecause: STRING
        }
      }
    },
    reason: STRING,
    evidence: STRING_ARRAY,
    confidence: CONFIDENCE,
    status: { type: "string", enum: ["accepted", "rejected"] }
  }
};

const TRACE_DEF = {
  type: "object",
  additionalProperties: false,
  required: ["id", "iteration", "nodeId", "kind", "summary", "reason", "evidence", "confidence"],
  properties: {
    id: STRING,
    iteration: { type: "number", minimum: 1 },
    nodeId: STRING,
    kind: { type: "string", enum: ["classify", "expand", "decide", "halt"] },
    summary: STRING,
    reason: STRING,
    evidence: STRING_ARRAY,
    confidence: CONFIDENCE
  }
};

const STOP_DEF = {
  type: "object",
  additionalProperties: false,
  required: ["reason", "remainingQuestionIds", "leafIds", "message"],
  properties: {
    reason: { type: "string", enum: ["frontier_empty", "needs_user", "budget"] },
    remainingQuestionIds: ID_ARRAY,
    leafIds: ID_ARRAY,
    message: STRING
  }
};

export const PLAN_V1_SCHEMA: Record<string, unknown> = {
  $id: "projectplaner:llm-json-schema:plan_v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema",
    "brief",
    "budget",
    "rootId",
    "plans",
    "tasks",
    "todos",
    "questions",
    "decisions",
    "trace",
    "stop"
  ],
  properties: {
    schema: { const: PLAN_V1_SCHEMA_NAME },
    brief: {
      type: "object",
      additionalProperties: false,
      required: ["task", "constraints", "context", "success"],
      properties: {
        task: STRING,
        constraints: STRING_ARRAY,
        context: { type: "object" },
        success: STRING
      }
    },
    budget: {
      type: "object",
      additionalProperties: false,
      required: ["maxDepth", "maxNodes", "maxLlmTurns"],
      properties: {
        maxDepth: { type: "number", minimum: 1 },
        maxNodes: { type: "number", minimum: 1 },
        maxLlmTurns: { type: "number", minimum: 1 }
      }
    },
    rootId: STRING,
    plans: { type: "object", additionalProperties: { $ref: "#/$defs/plan" } },
    tasks: { type: "object", additionalProperties: { $ref: "#/$defs/task" } },
    todos: { type: "object", additionalProperties: { $ref: "#/$defs/todo" } },
    questions: { type: "object", additionalProperties: { $ref: "#/$defs/question" } },
    decisions: { type: "object", additionalProperties: { $ref: "#/$defs/decision" } },
    trace: { type: "array", items: { $ref: "#/$defs/trace" } },
    stop: {
      oneOf: [{ type: "null" }, { $ref: "#/$defs/stop" }]
    }
  },
  $defs: {
    plan: PLAN_DEF,
    task: TASK_DEF,
    todo: TODO_DEF,
    question: QUESTION_DEF,
    decision: DECISION_DEF,
    trace: TRACE_DEF,
    stop: STOP_DEF
  }
};

/** Spine-only example: product-scale brief, not a fully expanded tree. */
export const TRADING_CARD_SPINE_PLAN: PlanDocument = {
  schema: PLAN_V1_SCHEMA_NAME,
  brief: {
    task: "I want a mobile app that looks nice and where I can register my trading cards",
    constraints: ["Do not unroll a full ticket dump on the first expand", "Keep look-and-feel as a real aspect"],
    context: { productKind: "consumer-mobile", domain: "collectible-cards" },
    success: "A spine of meaning anchors a human can inspect; blocked subtrees are explicit questions."
  },
  budget: { ...PLAN_V1_DEFAULT_BUDGET },
  rootId: "p_root",
  plans: {
    p_root: {
      id: "p_root",
      title: "Trading card companion app",
      parentId: null,
      dependsOn: [],
      taskIds: ["t_identity", "t_collection", "t_store", "t_sync", "t_visual"],
      why: "Product-scale brief. Spine first; recurse only where classify is needs_subplan."
    },
    p_collection: {
      id: "p_collection",
      title: "Collection register",
      parentId: "p_root",
      dependsOn: [],
      taskIds: [],
      why: "Registering cards is still a system; child plan exists but is not expanded."
    }
  },
  tasks: {
    t_identity: {
      id: "t_identity",
      planId: "p_root",
      title: "Identity and accounts",
      description: "Who owns a collection and how they sign in.",
      dependsOn: [],
      todoIds: ["td_identity"],
      suggestedType: "aspect"
    },
    t_collection: {
      id: "t_collection",
      planId: "p_root",
      title: "Collection register",
      description: "Capture, browse, and identify physical trading cards.",
      dependsOn: ["t_identity"],
      todoIds: ["td_collection"],
      suggestedType: "aspect"
    },
    t_store: {
      id: "t_store",
      planId: "p_root",
      title: "Store and commerce",
      description: "Whether buying/selling is in scope, and how it attaches to the register.",
      dependsOn: ["t_collection"],
      todoIds: ["td_store"],
      suggestedType: "aspect"
    },
    t_sync: {
      id: "t_sync",
      planId: "p_root",
      title: "Sync and devices",
      description: "How collections move across phones and backups.",
      dependsOn: ["t_identity"],
      todoIds: ["td_sync"],
      suggestedType: "feature"
    },
    t_visual: {
      id: "t_visual",
      planId: "p_root",
      title: "Visual system",
      description: "Looks nice as a named surface, not a vibe.",
      dependsOn: [],
      todoIds: ["td_visual"],
      suggestedType: "aspect"
    }
  },
  todos: {
    td_identity: {
      id: "td_identity",
      taskId: "t_identity",
      title: "Choose identity pattern",
      status: "needs_decision",
      acceptance: [],
      questionIds: [],
      decisionIds: [],
      planId: null
    },
    td_collection: {
      id: "td_collection",
      taskId: "t_collection",
      title: "Plan the collection register",
      status: "needs_subplan",
      acceptance: [],
      questionIds: [],
      decisionIds: [],
      planId: "p_collection"
    },
    td_store: {
      id: "td_store",
      taskId: "t_store",
      title: "Decide whether commerce is in v1",
      status: "needs_question",
      acceptance: [],
      questionIds: ["q_commerce"],
      decisionIds: [],
      planId: null
    },
    td_sync: {
      id: "td_sync",
      taskId: "t_sync",
      title: "Name target platforms",
      status: "needs_question",
      acceptance: [],
      questionIds: ["q_platforms"],
      decisionIds: [],
      planId: null
    },
    td_visual: {
      id: "td_visual",
      taskId: "t_visual",
      title: "Treat look-and-feel as a named aspect",
      status: "atomic",
      acceptance: [
        "Visual system is a first-class spine node, not a leftover aesthetic note",
        "No subplan until there is a concrete UI surface to break down"
      ],
      questionIds: [],
      decisionIds: [],
      planId: null
    }
  },
  questions: {
    q_commerce: {
      id: "q_commerce",
      nodeId: "td_store",
      kind: "scope",
      text: "Is buying or selling cards in v1, or is the store only a catalog of owned cards?",
      blocks: ["td_store"],
      status: "open"
    },
    q_platforms: {
      id: "q_platforms",
      nodeId: "td_sync",
      kind: "missing_fact",
      text: "iOS, Android, or both for v1?",
      blocks: ["td_sync"],
      status: "open"
    }
  },
  decisions: {},
  trace: [
    {
      id: "tr_1",
      iteration: 1,
      nodeId: "p_root",
      kind: "expand",
      summary: "Seeded product spine",
      reason: "First expand of a product-scale brief must stay 3–8 meaning anchors.",
      evidence: ["brief.task"],
      confidence: 0.8
    }
  ],
  stop: null
};

export function planTodoIsLeaf(
  todo: PlanTodo,
  questions: Record<string, PlanQuestion> = {}
): boolean {
  if (todo.status !== "atomic" || todo.planId !== null || todo.acceptance.length === 0) {
    return false;
  }
  return todo.questionIds.every((id) => questions[id]?.status === "answered");
}

/** True when classify/expand still owes work, or the node is blocked on the user. */
export function planTodoIsUnresolved(
  todo: PlanTodo,
  questions: Record<string, PlanQuestion> = {}
): boolean {
  if (todo.status === "dropped" || planTodoIsLeaf(todo, questions)) {
    return false;
  }
  if (todo.status === "needs_subplan" && todo.planId) {
    return false;
  }
  return true;
}

export function planTodoIsPickable(
  todo: PlanTodo,
  questions: Record<string, PlanQuestion> = {}
): boolean {
  if (!planTodoIsUnresolved(todo, questions)) {
    return false;
  }
  return todo.status !== "needs_question" && todo.status !== "needs_decision";
}

export function openQuestionIds(plan: PlanDocument): string[] {
  return Object.values(plan.questions)
    .filter((question) => question.status === "open")
    .map((question) => question.id);
}

export function leafTodoIds(plan: PlanDocument): string[] {
  return Object.values(plan.todos)
    .filter((todo) => planTodoIsLeaf(todo, plan.questions))
    .map((todo) => todo.id);
}

export function planNodeCount(plan: PlanDocument): number {
  return (
    Object.keys(plan.plans).length +
    Object.keys(plan.tasks).length +
    Object.keys(plan.todos).length
  );
}

export function planMaxDepth(plan: PlanDocument): number {
  const depth = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) {
      return 0;
    }
    seen.add(id);
    const node = plan.plans[id];
    if (!node) {
      return 0;
    }
    const children = Object.values(plan.plans).filter((child) => child.parentId === id);
    if (children.length === 0) {
      return 0;
    }
    return 1 + Math.max(...children.map((child) => depth(child.id, seen)));
  };
  return depth(plan.rootId, new Set());
}

export function suggestPlanStop(plan: PlanDocument): PlanStop {
  const leaves = leafTodoIds(plan);
  const remainingQuestions = openQuestionIds(plan);
  if (planNodeCount(plan) > plan.budget.maxNodes || plan.trace.length >= plan.budget.maxLlmTurns) {
    return {
      reason: "budget",
      remainingQuestionIds: remainingQuestions,
      leafIds: leaves,
      message: "Stopped on budget (nodes or LLM turns)."
    };
  }
  if (planMaxDepth(plan) >= plan.budget.maxDepth) {
    return {
      reason: "budget",
      remainingQuestionIds: remainingQuestions,
      leafIds: leaves,
      message: "Stopped on maxDepth."
    };
  }
  const active = Object.values(plan.todos).filter((todo) => todo.status !== "dropped");
  const unresolved = active.filter((todo) => planTodoIsUnresolved(todo, plan.questions));
  if (unresolved.length === 0) {
    return {
      reason: "frontier_empty",
      remainingQuestionIds: remainingQuestions,
      leafIds: leaves,
      message: "No remaining work nodes to classify or expand."
    };
  }
  const onlyQuestions = unresolved.every((todo) => todo.status === "needs_question");
  if (onlyQuestions) {
    return {
      reason: "needs_user",
      remainingQuestionIds: remainingQuestions,
      leafIds: leaves,
      message: "Remaining work is blocked on open questions."
    };
  }
  return {
    reason: "needs_user",
    remainingQuestionIds: remainingQuestions,
    leafIds: leaves,
    message: "Frontier still has decisions or subplans; inspect later."
  };
}

export function validatePlanV1(value: unknown): { ok: true; plan: PlanDocument } | { ok: false; errors: string[] } {
  const errors = validateJsonSchema(PLAN_V1_SCHEMA, value);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, plan: value as PlanDocument };
}

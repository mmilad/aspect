import {
  PLAN_V1_DEFAULT_BUDGET,
  PLAN_V1_SCHEMA_NAME,
  planMaxDepth,
  planTodoIsPickable,
  suggestPlanStop,
  type PlanBrief,
  type PlanBudget,
  type PlanDecision,
  type PlanDocument,
  type PlanQuestion,
  type PlanStop,
  type PlanTask,
  type PlanTodo,
  type PlanTraceEntry
} from "./plan-v1";
import { assertExpandChildren, type PlanClassifyWrite, type PlanExpandWrite } from "./plan-v1-writes";

function usedIds(plan: PlanDocument): Set<string> {
  return new Set([
    ...Object.keys(plan.plans),
    ...Object.keys(plan.tasks),
    ...Object.keys(plan.todos),
    ...Object.keys(plan.questions),
    ...Object.keys(plan.decisions),
    ...plan.trace.map((entry) => entry.id)
  ]);
}

function slugId(prefix: string, title: string, used: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 24) || "item";
  let id = `${prefix}_${base}`;
  let n = 2;
  while (used.has(id)) {
    id = `${prefix}_${base}_${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function clonePlan(plan: PlanDocument): PlanDocument {
  return JSON.parse(JSON.stringify(plan)) as PlanDocument;
}

function appendTrace(
  plan: PlanDocument,
  kind: PlanTraceEntry["kind"],
  nodeId: string,
  summary: string,
  reason: string
): void {
  const iteration = plan.trace.length + 1;
  plan.trace.push({
    id: slugId("tr", `${kind}_${iteration}`, usedIds(plan)),
    iteration,
    nodeId,
    kind,
    summary,
    reason,
    evidence: [nodeId],
    confidence: 0.7
  });
}

export function seedRootPlan(brief: PlanBrief, budget?: Partial<PlanBudget> | null): PlanDocument {
  const mergedBudget: PlanBudget = {
    maxDepth: budget?.maxDepth ?? PLAN_V1_DEFAULT_BUDGET.maxDepth,
    maxNodes: budget?.maxNodes ?? PLAN_V1_DEFAULT_BUDGET.maxNodes,
    maxLlmTurns: budget?.maxLlmTurns ?? PLAN_V1_DEFAULT_BUDGET.maxLlmTurns
  };
  const used = new Set<string>();
  const rootId = slugId("p", "root", used);
  const taskId = slugId("t", brief.task, used);
  const todoId = slugId("td", brief.task, used);
  const plan: PlanDocument = {
    schema: PLAN_V1_SCHEMA_NAME,
    brief,
    budget: mergedBudget,
    rootId,
    plans: {
      [rootId]: {
        id: rootId,
        title: brief.task,
        parentId: null,
        dependsOn: [],
        taskIds: [taskId],
        why: "Root plan seeded from the brief; classify before expanding."
      }
    },
    tasks: {
      [taskId]: {
        id: taskId,
        planId: rootId,
        title: brief.task,
        description: brief.success,
        dependsOn: [],
        todoIds: [todoId],
        suggestedType: "feature"
      }
    },
    todos: {
      [todoId]: {
        id: todoId,
        taskId,
        title: brief.task,
        status: "needs_subplan",
        acceptance: [],
        questionIds: [],
        decisionIds: [],
        planId: null
      }
    },
    questions: {},
    decisions: {},
    trace: [],
    stop: null
  };
  appendTrace(plan, "expand", rootId, "Seeded root plan", "Initial document from brief.");
  return plan;
}

/** If the model wrote a plan id, use the frontier todo when it exists. */
export function resolvePlanTodoId(
  plan: PlanDocument,
  writtenId: string,
  frontierId?: string | null
): string {
  if (writtenId && plan.todos[writtenId]) {
    return writtenId;
  }
  if (frontierId && plan.todos[frontierId]) {
    return frontierId;
  }
  return writtenId;
}

export function pickPlanFrontier(plan: PlanDocument): string | null {
  const stop = suggestPlanStop(plan);
  if (stop.reason === "budget") {
    return null;
  }
  for (const todo of Object.values(plan.todos)) {
    if (planTodoIsPickable(todo, plan.questions)) {
      return todo.id;
    }
  }
  return null;
}

export function applyPlanClassify(
  plan: PlanDocument,
  write: PlanClassifyWrite,
  frontierId?: string | null
): { ok: true; plan: PlanDocument } | { ok: false; error: string } {
  const next = clonePlan(plan);
  const nodeId = resolvePlanTodoId(next, write.nodeId, frontierId);
  const todo = next.todos[nodeId];
  if (!todo) {
    return { ok: false, error: `classify nodeId '${write.nodeId}' is not a todo.` };
  }
  if (write.status === "needs_subplan" && planMaxDepth(next) >= next.budget.maxDepth) {
    return {
      ok: false,
      error: `already at maxDepth (${next.budget.maxDepth}); choose atomic, needs_question, or needs_decision instead of expanding.`
    };
  }
  todo.status = write.status;
  if (write.status === "atomic") {
    todo.acceptance = write.acceptance ?? [];
    if (todo.acceptance.length === 0) {
      return { ok: false, error: "atomic classify requires acceptance." };
    }
  }
  if (write.status === "needs_question") {
    if (!write.question) {
      return { ok: false, error: "needs_question classify requires question." };
    }
    const questionId = slugId("q", write.question.text, usedIds(next));
    const question: PlanQuestion = {
      id: questionId,
      nodeId: todo.id,
      kind: write.question.kind,
      text: write.question.text,
      blocks: [todo.id],
      status: "open"
    };
    next.questions[questionId] = question;
    todo.questionIds = [...todo.questionIds, questionId];
  }
  if (write.status !== "needs_subplan") {
    todo.planId = null;
  }
  appendTrace(next, "classify", todo.id, `Classified ${todo.id} as ${write.status}`, write.reason);
  next.stop = null;
  return { ok: true, plan: next };
}

export function applyPlanExpand(
  plan: PlanDocument,
  write: PlanExpandWrite,
  frontierId?: string | null
): { ok: true; plan: PlanDocument } | { ok: false; error: string } {
  const next = clonePlan(plan);
  const parentId = resolvePlanTodoId(next, write.parentId, frontierId);
  const todo = next.todos[parentId];
  if (!todo) {
    return { ok: false, error: `expand parentId '${write.parentId}' is not a todo.` };
  }
  if (planMaxDepth(next) >= next.budget.maxDepth) {
    return {
      ok: false,
      error: `already at maxDepth (${next.budget.maxDepth}); do not expand.`
    };
  }
  const task = next.tasks[todo.taskId];
  if (!task) {
    return { ok: false, error: `expand parent task '${todo.taskId}' missing.` };
  }
  const asserted = assertExpandChildren(todo.title, write.children);
  if (!asserted.ok) {
    return { ok: false, error: asserted.errors.join("; ") };
  }
  const used = usedIds(next);
  const childPlanId = slugId("p", todo.title, used);
  const parentPlan = next.plans[task.planId];
  if (!parentPlan) {
    return { ok: false, error: `expand parent plan '${task.planId}' missing.` };
  }
  next.plans[childPlanId] = {
    id: childPlanId,
    title: todo.title,
    parentId: parentPlan.id,
    dependsOn: [],
    taskIds: [],
    why: `Subplan for ${todo.title}.`
  };
  todo.status = "needs_subplan";
  todo.planId = childPlanId;

  const titleToTaskId = new Map<string, string>();
  const created: PlanTask[] = [];
  for (const child of write.children) {
    const taskId = slugId("t", child.title, used);
    const todoId = slugId("td", child.title, used);
    titleToTaskId.set(child.title.trim().toLowerCase(), taskId);
    const newTask: PlanTask = {
      id: taskId,
      planId: childPlanId,
      title: child.title,
      description: child.why,
      dependsOn: [],
      todoIds: [todoId],
      suggestedType: child.suggestedType
    };
    const newTodo: PlanTodo = {
      id: todoId,
      taskId,
      title: child.title,
      status: "needs_subplan",
      acceptance: [],
      questionIds: [],
      decisionIds: [],
      planId: null
    };
    next.tasks[taskId] = newTask;
    next.todos[todoId] = newTodo;
    created.push(newTask);
    next.plans[childPlanId]!.taskIds.push(taskId);
  }
  for (let i = 0; i < write.children.length; i += 1) {
    const child = write.children[i]!;
    const createdTask = created[i]!;
    createdTask.dependsOn = child.dependsOn
      .map((title) => titleToTaskId.get(title.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));
  }
  appendTrace(next, "expand", todo.id, `Expanded ${todo.id}`, `Added ${write.children.length} children.`);
  next.stop = null;
  return { ok: true, plan: next };
}

export function haltPlanDocument(plan: PlanDocument): { plan: PlanDocument; stop: PlanStop } {
  const next = clonePlan(plan);
  const stop = suggestPlanStop(next);
  next.stop = stop;
  appendTrace(next, "halt", next.rootId, `Halt ${stop.reason}`, stop.message);
  return { plan: next, stop };
}

export function planDocumentPersistRoute(targetTaskId: unknown): "persist" | "skip" {
  return typeof targetTaskId === "string" && targetTaskId.trim() ? "persist" : "skip";
}

export function planDocumentTitle(plan: PlanDocument): string {
  const rootTitle = plan.plans[plan.rootId]?.title?.trim();
  if (rootTitle) {
    return rootTitle;
  }
  const brief = plan.brief.task.trim();
  return brief || "Plan";
}

export const PLAN_DOCUMENT_PERSIST_REASON = "Sealed goal_planning plan.v1 onto the planned Task.";

/** Bag shape Thinking should instantiate as decision.result. */
export const PLAN_THINKING_EXPECTED_OUTPUT = {
  kind: "object",
  requiredFields: ["chosen"],
  fields: {
    chosen: { kind: "primitive", type: "string" },
    reason: { kind: "primitive", type: "string" }
  }
} as const;

export type ThoughtDecisionLike = {
  decision: string;
  accepted: boolean;
  reason: string;
  evidence?: string[];
  confidence?: number;
  rejectedAlternatives?: Array<{ alternative: string; reason: string }>;
  result?: unknown;
};

export function prepareThinkingInputs(
  plan: PlanDocument,
  frontierId: string
):
  | {
      ok: true;
      values: {
        thinkTask: string;
        thinkContext: Record<string, unknown>;
        thinkConstraints: string[];
        thinkExpectedOutput: typeof PLAN_THINKING_EXPECTED_OUTPUT;
        thinkMaxIterations: number;
      };
    }
  | { ok: false; error: string } {
  const todo = plan.todos[frontierId];
  if (!todo) {
    return { ok: false, error: `prepareThink frontierId '${frontierId}' is not a todo.` };
  }
  const task = plan.tasks[todo.taskId];
  return {
    ok: true,
    values: {
      thinkTask: `Decide: ${todo.title}`,
      thinkContext: {
        brief: plan.brief,
        todo,
        task: task ?? null,
        success: plan.brief.success
      },
      thinkConstraints: plan.brief.constraints,
      thinkExpectedOutput: PLAN_THINKING_EXPECTED_OUTPUT,
      thinkMaxIterations: 2
    }
  };
}

function asThoughtDecision(raw: unknown): { ok: true; thought: ThoughtDecisionLike } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "applyDecide requires thoughtDecision." };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.decision !== "string" || !record.decision.trim()) {
    return { ok: false, error: "thoughtDecision.decision must be a non-empty string." };
  }
  if (typeof record.accepted !== "boolean") {
    return { ok: false, error: "thoughtDecision.accepted must be a boolean." };
  }
  if (typeof record.reason !== "string" || !record.reason.trim()) {
    return { ok: false, error: "thoughtDecision.reason must be a non-empty string." };
  }
  const alternatives = Array.isArray(record.rejectedAlternatives)
    ? record.rejectedAlternatives.filter(
        (item): item is { alternative: string; reason: string } =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as { alternative?: unknown }).alternative === "string" &&
          typeof (item as { reason?: unknown }).reason === "string"
      )
    : [];
  const evidence = Array.isArray(record.evidence)
    ? record.evidence.filter((item): item is string => typeof item === "string")
    : [];
  const confidence = typeof record.confidence === "number" ? record.confidence : 0.7;
  return {
    ok: true,
    thought: {
      decision: record.decision.trim(),
      accepted: record.accepted,
      reason: record.reason.trim(),
      evidence,
      confidence,
      rejectedAlternatives: alternatives,
      result: record.result
    }
  };
}

export function applyPlanDecide(
  plan: PlanDocument,
  input: { nodeId: string; thought: unknown }
): { ok: true; plan: PlanDocument } | { ok: false; error: string } {
  const parsed = asThoughtDecision(input.thought);
  if (!parsed.ok) {
    return parsed;
  }
  if (!parsed.thought.accepted) {
    return { ok: false, error: "Thinking completed without an accepted decision." };
  }
  const next = clonePlan(plan);
  const todo = next.todos[input.nodeId];
  if (!todo) {
    return { ok: false, error: `decide nodeId '${input.nodeId}' is not a todo.` };
  }
  const used = usedIds(next);
  const decisionId = slugId("d", parsed.thought.decision, used);
  const decision: PlanDecision = {
    id: decisionId,
    nodeId: todo.id,
    question: todo.title,
    chosen: parsed.thought.decision,
    alternatives: (parsed.thought.rejectedAlternatives ?? []).map((item) => ({
      option: item.alternative,
      rejectedBecause: item.reason
    })),
    reason: parsed.thought.reason,
    evidence: parsed.thought.evidence ?? [],
    confidence: parsed.thought.confidence ?? 0.7,
    status: "accepted"
  };
  next.decisions[decisionId] = decision;
  todo.decisionIds = [...todo.decisionIds, decisionId];
  todo.status = "atomic";
  todo.acceptance =
    todo.acceptance.length > 0 ? todo.acceptance : [`Decision: ${parsed.thought.decision}`];
  todo.planId = null;
  appendTrace(next, "decide", todo.id, `Decided ${todo.id}`, parsed.thought.reason);
  next.stop = null;
  return { ok: true, plan: next };
}

import type { WorkflowContextBag, WorkflowGraph } from "../workflow/graph";
import type {
  AssistantRoute,
  AssistantTraceRunStatus,
  AssistantTraceStepStatus,
  AssistantTurnTrace
} from "./types";

export type AssistantTraceRunSource = {
  id: string;
  status: string;
  definitionSnapshot: WorkflowGraph;
  bag: WorkflowContextBag;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
};

function runStatus(value: string): AssistantTraceRunStatus {
  if (["running", "pending_llm", "pending_user", "waiting", "completed", "failed", "cancelled"].includes(value)) {
    return value as AssistantTraceRunStatus;
  }
  return "failed";
}

function stepStatus(run: AssistantTraceRunSource, nodeId: string): AssistantTraceStepStatus {
  if (run.status === "failed" && run.bag.cursor === nodeId) {
    return "failed";
  }
  if (["running", "pending_llm", "pending_user", "waiting"].includes(run.status) && run.bag.cursor === nodeId) {
    return "waiting";
  }
  return "completed";
}

function pinValue(bag: WorkflowContextBag, nodeId: string, pin: string): unknown {
  const pins = bag.frame?.pins ?? {};
  const directKey = `${nodeId}::${pin}`;
  if (directKey in pins) {
    return pins[directKey];
  }
  // Older Break executions wrote only the source object. Preserve trace
  // visibility for those persisted runs while new executions expose typed
  // child pins directly.
  const value = pins[`${nodeId}::value`];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[pin]
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function routeValue(value: unknown): AssistantRoute["route"] | undefined {
  return ["reply", "clarify", "retrieve", "delegate", "resume"].includes(String(value))
    ? value as AssistantRoute["route"]
    : undefined;
}

function lookupValue(value: unknown): NonNullable<AssistantRoute["lookupKind"]> | undefined {
  return ["agents", "agent", "entities", "entity", "workflows", "neighborhood", "knowledge_catalog", "knowledge", "files", "file"].includes(String(value))
    ? value as NonNullable<AssistantRoute["lookupKind"]>
    : undefined;
}

/** Project persisted workflow state into a safe, operational Assistant trace. */
export function projectAssistantTrace(run: AssistantTraceRunSource): AssistantTurnTrace {
  const nodes = new Map(run.definitionSnapshot.nodes.map((node) => [node.id, node]));
  const steps = (run.bag.history ?? []).map((entry) => ({
    nodeId: entry.nodeId,
    title: typeof nodes.get(entry.nodeId)?.data.title === "string" && nodes.get(entry.nodeId)!.data.title!.trim()
      ? nodes.get(entry.nodeId)!.data.title!
      : entry.nodeId,
    type: nodes.get(entry.nodeId)?.type ?? "unknown",
    visit: entry.visit,
    status: stepStatus(run, entry.nodeId),
    createdAt: entry.createdAt
  } satisfies {
    nodeId: string;
    title: string;
    type: string;
    visit: number;
    status: AssistantTraceStepStatus;
    createdAt: string;
  }));
  const route = routeValue(pinValue(run.bag, "break_decision", "route"));
  const lookupKind = lookupValue(pinValue(run.bag, "break_decision", "lookupKind"));
  const lookupDatasetKey = stringValue(pinValue(run.bag, "break_decision", "lookupDatasetKey"));
  const agentId = stringValue(pinValue(run.bag, "break_decision", "agentId"));
  const delegationStatus = stringValue(pinValue(run.bag, "delegate", "delegationStatus"));

  return {
    runId: run.id,
    status: runStatus(run.status),
    startedAt: run.startedAt,
    ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
    steps,
    ...(route ? { route } : {}),
    ...(lookupKind ? { lookupKind } : {}),
    ...(lookupDatasetKey ? { lookupDatasetKey } : {}),
    ...(agentId || delegationStatus
      ? { delegation: { ...(agentId ? { agentId } : {}), ...(delegationStatus ? { status: delegationStatus } : {}) } }
      : {}),
    ...(run.error ? { error: run.error } : {})
  };
}

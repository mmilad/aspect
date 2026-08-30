import { parseWorkflowGraph, type WorkflowGraph } from "../../workflow/graph";
import { WorkflowRun } from "../../workflow/runtime/workflow";
import type { WorkflowLlmPending, WorkflowStepResult } from "../../workflow/runtime/types";
import { createStepGraph } from "../../workflow/presets/create_step/graph";
import { createWorkflowGraph } from "../../workflow/presets/create_workflow/graph";
import { chatCompletions, type LlmChatConfig } from "./chat-completions";
import { extractJsonObject } from "./generate";

export type CreateWorkflowLiveTurn = {
  turn: number;
  nodeId: string;
  schemaKey?: string;
  writes: Record<string, unknown>;
};

export type CreateWorkflowLiveInput = {
  brief: string;
  availableBagShape?: Record<string, unknown>;
  allowedNodeTypes?: string[];
  maxLlmTurns?: number;
  onTurn?: (turn: CreateWorkflowLiveTurn) => void;
};

export type CreateWorkflowLiveResult = {
  ok: boolean;
  persisted: false;
  status: WorkflowStepResult["kind"];
  message?: string;
  draft?: WorkflowGraph;
  stepDrafts?: unknown;
  turns: CreateWorkflowLiveTurn[];
};

function parsedGraph(raw: unknown): WorkflowGraph {
  const result = parseWorkflowGraph(raw);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.graph;
}

export function llmWritesFromPending(
  pending: WorkflowLlmPending,
  raw: string
): Record<string, unknown> {
  const parsedJson = extractJsonObject(raw);
  if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
    throw new Error("LLM JSON must be an object.");
  }
  const record = parsedJson as Record<string, unknown>;
  const keys = pending.outputSchema ?? [];
  if (keys.length === 0) {
    return record;
  }
  if (pending.format === "json_schema" && keys.length === 1 && !(keys[0]! in record)) {
    return { [keys[0]!]: record };
  }
  const writes: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in record) {
      writes[key] = record[key];
    }
  }
  if (Object.keys(writes).length === 0) {
    throw new Error(`LLM JSON missing output keys: ${keys.join(", ")}`);
  }
  return writes;
}

async function drain(run: WorkflowRun): Promise<WorkflowStepResult> {
  let step = await run.step();
  let hops = 0;
  while (step.kind === "advanced") {
    hops += 1;
    if (hops > 80) {
      throw new Error("create_workflow live run exceeded advanced-step budget");
    }
    step = await run.step();
  }
  return step;
}

/** Drive create_workflow against a live OpenAI-compatible endpoint (Ollama, etc.). */
export async function runCreateWorkflowLive(
  input: CreateWorkflowLiveInput,
  config: LlmChatConfig
): Promise<CreateWorkflowLiveResult> {
  const brief = input.brief.trim();
  if (!brief) {
    throw new Error("create_workflow live run requires a brief.");
  }

  const createStep = parsedGraph(createStepGraph);
  const run = new WorkflowRun({
    graph: parsedGraph(createWorkflowGraph),
    bag: {
      workflowId: "create_workflow",
      cursor: "start",
      goal: "create workflow",
      keys: {
        brief,
        ...(input.availableBagShape ? { availableBagShape: input.availableBagShape } : {}),
        ...(input.allowedNodeTypes ? { allowedNodeTypes: input.allowedNodeTypes } : {})
      },
      status: "running"
    },
    adapters: {
      resolveSubworkflow: (workflowId) => (workflowId === "create_step" ? createStep : null)
    }
  });

  const turns: CreateWorkflowLiveTurn[] = [];
  const maxLlmTurns = input.maxLlmTurns ?? 16;
  let step = await drain(run);

  while (step.kind === "pending_llm") {
    if (turns.length >= maxLlmTurns) {
      return liveSnapshot(step, turns, {
        ok: false,
        message: `Stopped after ${maxLlmTurns} LLM turns.`
      });
    }
    if (!step.llm) {
      throw new Error("pending_llm without llm payload");
    }

    const pending = step.llm;
    const content = await chatCompletions(
      config,
      [
        { role: "system", content: pending.systemPrompt || "Reply with JSON only." },
        { role: "user", content: pending.instructions }
      ],
      pending.jsonSchema
        ? { format: pending.jsonSchema, jsonSchemaName: pending.schemaKey ?? "llm_json" }
        : { format: "json" }
    );
    const writes = llmWritesFromPending(pending, content);
    const turn: CreateWorkflowLiveTurn = {
      turn: turns.length + 1,
      nodeId: pending.nodeId,
      schemaKey: pending.schemaKey,
      writes
    };
    turns.push(turn);
    input.onTurn?.(turn);

    step = await run.step({ llmWrites: writes });
    while (step.kind === "advanced") {
      step = await run.step();
    }
  }

  return liveSnapshot(step, turns);
}

function liveSnapshot(
  step: WorkflowStepResult,
  turns: CreateWorkflowLiveTurn[],
  extra?: { ok?: boolean; message?: string }
): CreateWorkflowLiveResult {
  const keys = step.bag?.keys ?? {};
  return {
    ok: extra?.ok ?? step.kind === "completed",
    persisted: false,
    status: step.kind,
    message: extra?.message ?? step.message,
    draft: keys.workflowDraft as WorkflowGraph | undefined,
    stepDrafts: keys.stepDrafts,
    turns
  };
}

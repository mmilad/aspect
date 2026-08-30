import type { DatabaseSync } from "node:sqlite";
import {
  chatCompletions,
  llmWritesFromPending,
  readLlmChatConfigFromEnv,
  workflowPresetAllowsDrainLlm,
  type WorkflowLlmPending
} from "@projectplaner/core";
import { runWorkflow, type RunWorkflowResult } from "@projectplaner/db/workflows";

export type LlmDrainTurn = {
  turn: number;
  nodeId: string;
  schemaKey?: string;
  writeKeys: string[];
};

export type DrainedWorkflowResult = RunWorkflowResult & {
  note?: string;
  turns: LlmDrainTurn[];
  llmConfigured: boolean;
};

export async function drainPendingLlm(
  db: DatabaseSync,
  started: RunWorkflowResult & { note?: string },
  options?: { maxTurns?: number }
): Promise<DrainedWorkflowResult> {
  const maxTurns = options?.maxTurns ?? 24;
  const config = readLlmChatConfigFromEnv();
  const turns: LlmDrainTurn[] = [];
  let current = started;

  if (current.step.kind !== "pending_llm") {
    return { ...current, turns, llmConfigured: Boolean(config) };
  }
  if (!config) {
    return {
      ...current,
      turns,
      llmConfigured: false,
      note: "Paused for LLM. Set PROJECTPLANER_LLM_BASE_URL and PROJECTPLANER_LLM_MODEL to drain steps from Run, or POST llmWrites."
    };
  }

  while (current.step.kind === "pending_llm" && turns.length < maxTurns) {
    const pending = current.step.llm as WorkflowLlmPending | undefined;
    if (!pending) {
      throw new Error("pending_llm missing llm payload.");
    }
    const content = await chatCompletions(
      config,
      [
        { role: "system", content: pending.systemPrompt || "Reply with JSON only." },
        { role: "user", content: pending.instructions }
      ],
      pending.jsonSchema
        ? { format: pending.jsonSchema, jsonSchemaName: pending.schemaKey ?? "llm_json" }
        : pending.format === "text"
          ? undefined
          : { format: "json" }
    );
    const writes = llmWritesFromPending(pending, content);
    turns.push({
      turn: turns.length + 1,
      nodeId: pending.nodeId,
      schemaKey: pending.schemaKey,
      writeKeys: Object.keys(writes)
    });
    current = await runWorkflow(db, {
      runId: current.run.id,
      llmWrites: writes
    });
  }

  if (current.step.kind === "pending_llm") {
    return {
      ...current,
      turns,
      llmConfigured: true,
      note: `Paused after ${turns.length} LLM turns (cap ${maxTurns}). POST llmWrites to continue.`
    };
  }
  return { ...current, turns, llmConfigured: true };
}

export function workflowRunJson(result: DrainedWorkflowResult) {
  const keys = result.step.bag?.keys ?? {};
  return {
    flow: result.flow,
    run: result.run,
    step: result.step,
    nodeRuns: result.nodeRuns,
    note: result.note,
    turns: result.turns,
    llmConfigured: result.llmConfigured,
    bag: {
      plan: keys.plan,
      stop: keys.stop,
      frontierId: keys.frontierId,
      result: keys.result,
      iterations: keys.iterations,
      decision: keys.decision,
      validation: keys.validation
    }
  };
}

export function shouldDrainPendingLlm(
  requested: boolean | undefined,
  presetKey: unknown
): boolean {
  if (!requested) {
    return false;
  }
  const key = typeof presetKey === "string" ? presetKey : null;
  return workflowPresetAllowsDrainLlm(key);
}

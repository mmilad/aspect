import type { WorkflowClient } from "./client/workflow-client";
import type { StartWorkflowInput, WorkflowRunResponse } from "./client/types";
import { isPendingLlm } from "./client/pending-llm";
import type { LlmAdapter } from "./llm/types";
import { resumePendingWithAdapter } from "./llm/resume";

export type RunLoopOptions = {
  client: WorkflowClient;
  start: StartWorkflowInput;
  /** When set, pending_llm steps are auto-resumed. */
  adapter?: LlmAdapter;
  workflowKey?: string;
  /** Safety cap on LLM resume iterations (default 8). */
  maxLlmSteps?: number;
};

export type RunLoopResult = {
  response: WorkflowRunResponse;
  llmSteps: number;
  history: Array<{ step: string; runId: string; status: string }>;
};

/**
 * Start a workflow and auto-resume pending_llm via adapter until settled
 * (completed / failed / pending_user / no adapter / max steps).
 */
export async function runWorkflowLoop(options: RunLoopOptions): Promise<RunLoopResult> {
  const maxLlmSteps = options.maxLlmSteps ?? 8;
  const workflowKey = options.workflowKey ?? options.start.key;
  const history: RunLoopResult["history"] = [];

  let response = await options.client.start(options.start);
  history.push({
    step: response.step.kind,
    runId: response.run.id,
    status: response.run.status
  });

  let llmSteps = 0;
  while (isPendingLlm(response) && options.adapter) {
    if (llmSteps >= maxLlmSteps) {
      throw new Error(`Exceeded max LLM resume steps (${maxLlmSteps}) for run ${response.run.id}.`);
    }
    response = await resumePendingWithAdapter({
      client: options.client,
      adapter: options.adapter,
      response,
      workflowKey
    });
    llmSteps += 1;
    history.push({
      step: response.step.kind,
      runId: response.run.id,
      status: response.run.status
    });
  }

  return { response, llmSteps, history };
}

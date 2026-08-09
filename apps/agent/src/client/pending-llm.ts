import type { PendingLlmSurface, WorkflowRunResponse } from "./types";

export function isPendingLlm(response: WorkflowRunResponse): boolean {
  return response.step.kind === "pending_llm" || response.run.status === "pending_llm";
}

/** Extract host-facing pending_llm fields without exposing the full bag/graph. */
export function toPendingLlmSurface(response: WorkflowRunResponse): PendingLlmSurface | null {
  if (!isPendingLlm(response)) {
    return null;
  }
  const llm = response.step.llm;
  return {
    runId: response.run.id,
    nodeId: llm?.nodeId ?? response.step.nodeId,
    instructions: llm?.instructions ?? "",
    reads: llm?.reads ?? {},
    shapes: llm?.shapes,
    outputSchema: llm?.outputSchema ?? [],
    tools: llm?.tools ?? [],
    warnings: llm?.warnings
  };
}

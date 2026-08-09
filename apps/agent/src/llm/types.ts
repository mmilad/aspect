import type { PendingLlmSurface } from "../client/types";

export type LlmCompleteInput = {
  pending: PendingLlmSurface;
  /** Optional workflow key/id for fixture lookup. */
  workflowKey?: string;
};

export type LlmAdapter = {
  /** Return llmWrites for resume. Must cover pending.outputSchema keys when possible. */
  complete(input: LlmCompleteInput): Promise<Record<string, unknown>>;
};

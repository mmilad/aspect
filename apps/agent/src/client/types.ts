export type WorkflowRunStatus =
  | "running"
  | "pending_llm"
  | "pending_user"
  | "completed"
  | "failed"
  | "waiting"
  | string;

export type WorkflowStepKind =
  | "advanced"
  | "pending_llm"
  | "pending_user"
  | "completed"
  | "failed"
  | string;

/** Compact pending_llm payload for the semi-agent host (no full graph dump). */
export type PendingLlmSurface = {
  runId: string;
  nodeId: string | null;
  systemPrompt: string;
  instructions: string;
  reads: Record<string, unknown>;
  shapes?: Record<string, string>;
  outputSchema: string[];
  tools: string[];
  warnings?: string[];
};

export type WorkflowLlmPending = {
  nodeId: string;
  systemPrompt?: string;
  instructions: string;
  reads: Record<string, unknown>;
  shapes?: Record<string, string>;
  outputSchema: string[];
  tools: string[];
  warnings?: string[];
};

export type WorkflowStep = {
  kind: WorkflowStepKind;
  bag: Record<string, unknown>;
  nodeId: string | null;
  message?: string;
  llm?: WorkflowLlmPending;
};

export type WorkflowRun = {
  id: string;
  status: WorkflowRunStatus;
  workflowId: string;
  bag?: Record<string, unknown>;
};

export type WorkflowFlow = {
  id: string;
  title?: string;
  key?: string | null;
  type?: string;
};

export type WorkflowRunResponse = {
  flow: WorkflowFlow;
  run: WorkflowRun;
  step: WorkflowStep;
  nodeRuns?: unknown[];
  note?: string;
  error?: string;
};

export type StartWorkflowInput = {
  key?: string;
  id?: string;
  projectKey?: string;
  goal?: string;
  bag?: Record<string, unknown>;
};

export type ResumeWorkflowInput = {
  runId: string;
  llmWrites?: Record<string, unknown>;
  userRoute?: string;
  projectKey?: string;
};

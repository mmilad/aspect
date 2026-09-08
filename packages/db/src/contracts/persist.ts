import type { JsonRecord, WorkflowGraph } from "@projectplaner/core";
export type WorkflowTriggerKind = "manual" | "api" | "entity_status" | "schedule" | "webhook";
export type WorkflowRunStatus = "running" | "pending_llm" | "pending_user" | "waiting" | "completed" | "failed" | "cancelled";
export type WorkflowNodeRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "waiting";
export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  kind: WorkflowTriggerKind;
  enabled: boolean;
  config: JsonRecord;
}
export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  triggerId: string | null;
  versionId: string | null;
  status: WorkflowRunStatus;
  definitionSnapshot: WorkflowGraph;
  bag: JsonRecord;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}
export interface WorkflowNodeRun {
  id: string;
  runId: string;
  nodeId: string;
  attempt: number;
  status: WorkflowNodeRunStatus;
  input: JsonRecord;
  output: JsonRecord;
  routeLabel: string | null;
  error: JsonRecord | null;
  startedAt: string | null;
  finishedAt: string | null;
}
export interface Operations {
  loadGraph(workflowId: string): Promise<WorkflowGraph | null>;
  saveGraph(input: {
    workflowId: string;
    projectId: string;
    graph: WorkflowGraph;
  }): Promise<WorkflowGraph>;
  getOrMigrateGraph(input: {
    workflowId: string;
    projectId: string;
    metadata: JsonRecord;
  }): Promise<WorkflowGraph | null>;
  listTriggers(workflowId: string): Promise<WorkflowTrigger[]>;
  createRun(input: {
    workflowId: string;
    projectId: string;
    graph: WorkflowGraph;
    bag?: JsonRecord;
    triggerId?: string | null;
  }): Promise<WorkflowRunRecord>;
  updateRun(input: {
    id: string;
    status?: WorkflowRunStatus;
    bag?: JsonRecord;
    error?: string | null;
    finished?: boolean;
  }): Promise<void>;
  recordNodeRun(input: {
    runId: string;
    nodeId: string;
    attempt?: number;
    status: WorkflowNodeRunStatus;
    input?: JsonRecord;
    output?: JsonRecord;
    routeLabel?: string | null;
    error?: JsonRecord | null;
  }): Promise<WorkflowNodeRun>;
  listNodeRuns(runId: string): Promise<WorkflowNodeRun[]>;
  getRun(runId: string): Promise<WorkflowRunRecord | null>;
}

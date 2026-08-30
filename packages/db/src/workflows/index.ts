import persist from "./persist";
import {
  advanceWorkflowRun,
  createSqliteWorkflowAdapters,
  resolveWorkflowFlow,
  runWorkflow
} from "./execute";

const workflows = {
  persist,
  run: runWorkflow,
  advance: advanceWorkflowRun,
  resolve: resolveWorkflowFlow,
  createAdapters: createSqliteWorkflowAdapters
};

export default workflows;
export { persist };
export {
  advanceWorkflowRun,
  createSqliteWorkflowAdapters,
  resolveWorkflowFlow,
  runWorkflow,
  type AdvanceWorkflowRunInput,
  type AdvanceWorkflowRunResult,
  type ResolveWorkflowFlowInput,
  type RunWorkflowInput,
  type RunWorkflowResult
} from "./execute";
export type {
  WorkflowNodeRun,
  WorkflowNodeRunStatus,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowTrigger,
  WorkflowTriggerKind
} from "./persist";

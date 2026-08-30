import { Api } from "./api";
import { createDatabase, loadEnv, openDatabase } from "./client";
import { createExampleProject, EXAMPLE_PROJECT_KEY } from "./example-signal-desk";
import { ensureWorkflowPresets, findSeededWorkflowPreset, markWorkflowPresetDirty } from "./presets";
import query from "./query";
import entities from "./repositories/entities";
import llmJsonSchemas from "./repositories/llm-json-schemas";
import projects from "./repositories/projects";
import relations from "./repositories/relations";
import snapshots from "./repositories/snapshots";
import tags from "./repositories/tags";
import tasks from "./repositories/tasks";
import { rollupParentStatus } from "./rollup";
import workflows from "./workflows";

const planer = {
  entities,
  relations,
  projects,
  tags,
  tasks,
  snapshots,
  query,
  workflows,
  llmJsonSchemas
};

export default planer;

export {
  Api,
  createDatabase,
  createExampleProject,
  EXAMPLE_PROJECT_KEY,
  ensureWorkflowPresets,
  findSeededWorkflowPreset,
  loadEnv,
  markWorkflowPresetDirty,
  openDatabase,
  rollupParentStatus
};

export type {
  CreateAspectInput,
  CreateFeatureInput,
  CreateSemanticTaskInput,
  SemanticEntityInput
} from "./api";
export { AspectHandle, FeatureHandle, ProjectApi, TaskHandle } from "./api";

export type { CreateEntityInput, EntityQuery, UpdateEntityInput } from "./repositories/entities";
export type { CreateRelationInput, RelationQuery, UpdateRelationInput } from "./repositories/relations";
export type {
  CreateProjectInput,
  ProjectStats,
  ProjectStatsBucket,
  ProjectSummary
} from "./repositories/projects";
export { PROTECTED_PROJECT_KEY } from "./repositories/projects";
export type { CreateTaskInput } from "./repositories/tasks";
export type { GenericPlanExport, GenericProjectSnapshot } from "./repositories/snapshots";
export type {
  CreateLlmJsonSchemaInput,
  EnsureLlmJsonSchemasOptions,
  EnsureLlmJsonSchemasResult,
  LlmJsonSchemaRecord
} from "./repositories/llm-json-schemas";
export type {
  AdvanceWorkflowRunInput,
  AdvanceWorkflowRunResult,
  ResolveWorkflowFlowInput,
  RunWorkflowInput,
  RunWorkflowResult,
  WorkflowNodeRun,
  WorkflowNodeRunStatus,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowTrigger,
  WorkflowTriggerKind
} from "./workflows";

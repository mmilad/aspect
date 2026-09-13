import { assistantTurnGraph } from "./assistant_turn/graph";
import { assistantTurnPreset } from "./assistant_turn/preset";
import { authorWorkflowGraph } from "./author_workflow/graph";
import { authorWorkflowPreset } from "./author_workflow/preset";
import { createStepGraph } from "./create_step/graph";
import { createStepPreset } from "./create_step/preset";
import { createWorkflowGraph } from "./create_workflow/graph";
import { createWorkflowPreset } from "./create_workflow/preset";
import { listCrudPresetKeys, listCrudPresets, parseMutationPresetKey, presetKeyFor } from "./crud";
import { ensureAspectGraph } from "./ensure_aspect/graph";
import { ensureAspectPreset } from "./ensure_aspect/preset";
import { goalPlanningGraph } from "./goal_planning/graph";
import { rollupParentStatusGraph } from "./rollup_parent_status/graph";
import { thinkingGraph } from "./thinking/graph";
import { nextWorkPreset } from "./next_work/preset";
import { onboardingPreset } from "./onboarding/preset";
import { rollupParentStatusPreset } from "./rollup_parent_status/preset";
import { thinkingPreset } from "./thinking/preset";
import { recruitAgentGraph } from "./recruit_agent/graph";
import { recruitAgentPreset } from "./recruit_agent/preset";
import { goalPlanningPreset } from "./goal_planning/preset";
import { knowledgeCaptureGraph } from "./knowledge_capture/graph";
import { knowledgeCapturePreset } from "./knowledge_capture/preset";
import { knowledgeClassifyGraph } from "./knowledge_classify/graph";
import { knowledgeClassifyPreset } from "./knowledge_classify/preset";
import { knowledgeRetrieveGraph } from "./knowledge_retrieve/graph";
import { knowledgeRetrievePreset } from "./knowledge_retrieve/preset";
import {
  workflowPresetKinds,
  type WorkflowPreset,
  type WorkflowPresetKind
} from "./types";

export type {
  EnsureWorkflowPresetsOptions,
  EnsureWorkflowPresetsResult,
  WorkflowPreset,
  WorkflowPresetKind
} from "./types";
export { workflowPresetKinds } from "./types";
export { assistantTurnGraph } from "./assistant_turn/graph";
export { assistantTurnPreset } from "./assistant_turn/preset";
export {
  assistantContextPackFixture,
  assistantDecisionFixture,
  assistantReplyFixture,
  runAssistantEvaluation,
  type AssistantEvaluationCase,
  type AssistantEvaluationLlmWrites,
  type AssistantEvaluationResult
} from "./assistant_turn/evaluation";
export { authorWorkflowGraph } from "./author_workflow/graph";
export { authorWorkflowPreset } from "./author_workflow/preset";
export { createStepGraph } from "./create_step/graph";
export { createStepPreset } from "./create_step/preset";
export { createWorkflowGraph } from "./create_workflow/graph";
export { createWorkflowPreset } from "./create_workflow/preset";
export { ensureAspectGraph } from "./ensure_aspect/graph";
export { ensureAspectPreset } from "./ensure_aspect/preset";
export {
  listCrudPresetKeys,
  listCrudPresets,
  parseMutationPresetKey,
  presetKeyFor,
  type MutationOp
} from "./crud";
export { nextWorkPreset } from "./next_work/preset";
export { onboardingPreset } from "./onboarding/preset";
export { rollupParentStatusGraph } from "./rollup_parent_status/graph";
export { rollupParentStatusPreset } from "./rollup_parent_status/preset";
export { thinkingGraph } from "./thinking/graph";
export { thinkingPreset } from "./thinking/preset";
export { goalPlanningGraph } from "./goal_planning/graph";
export { goalPlanningPreset } from "./goal_planning/preset";
export { knowledgeCaptureGraph } from "./knowledge_capture/graph";
export { knowledgeCapturePreset } from "./knowledge_capture/preset";
export { knowledgeClassifyGraph } from "./knowledge_classify/graph";
export { knowledgeClassifyPreset } from "./knowledge_classify/preset";
export { knowledgeRetrieveGraph } from "./knowledge_retrieve/graph";
export { knowledgeRetrievePreset } from "./knowledge_retrieve/preset";

/** Seeded packs: mutation/rollup plus the pin-variable proof graph. */
export function listWorkflowPresets(): WorkflowPreset[] {
  return [
    ...listCrudPresets(),
    rollupParentStatusPreset,
    createStepPreset,
    createWorkflowPreset,
    thinkingPreset,
    goalPlanningPreset,
    assistantTurnPreset,
    recruitAgentPreset,
    knowledgeCapturePreset,
    knowledgeClassifyPreset,
    knowledgeRetrievePreset
  ];
}

/** Authoring packs kept in-repo but not seeded. */
export function listParkedWorkflowPresets(): WorkflowPreset[] {
  return [ensureAspectPreset, nextWorkPreset, onboardingPreset, authorWorkflowPreset];
}

/** Hosts must not drain pending_llm when the pack sets drainLlm: false. */
export function workflowPresetAllowsDrainLlm(presetKey?: string | null): boolean {
  if (!presetKey) {
    return true;
  }
  const preset = getWorkflowPreset(presetKey);
  return preset?.drainLlm !== false;
}

export function getWorkflowPreset(presetKey: string): WorkflowPreset | undefined {
  return [...listWorkflowPresets(), ...listParkedWorkflowPresets()].find(
    (preset) => preset.presetKey === presetKey
  );
}

export function isWorkflowPresetKind(value: unknown): value is WorkflowPresetKind {
  return typeof value === "string" && (workflowPresetKinds as readonly string[]).includes(value);
}

/** Catalog kind wins when `presetKey` is known; otherwise persisted `presetKind`, else `user`. */
export function resolveWorkflowKind(input: {
  presetKey?: unknown;
  kind?: unknown;
}): WorkflowPresetKind {
  if (typeof input.presetKey === "string") {
    const preset = getWorkflowPreset(input.presetKey);
    if (preset) {
      return preset.kind;
    }
  }
  return isWorkflowPresetKind(input.kind) ? input.kind : "user";
}

/** Resolve create/update/delete preset key when a pack exists in the catalog. */
export function resolveMutationPresetKey(input: {
  op: "create" | "update" | "delete";
  type: string;
}): string | null {
  const key = presetKeyFor(input.op, input.type as "aspect" | "feature" | "task");
  if (!parseMutationPresetKey(key)) {
    return null;
  }
  return getWorkflowPreset(key) ? key : null;
}

const presets = {
  list: listWorkflowPresets,
  listParked: listParkedWorkflowPresets,
  get: getWorkflowPreset,
  listWorkflowPresets,
  listParkedWorkflowPresets,
  getWorkflowPreset,
  workflowPresetAllowsDrainLlm,
  isWorkflowPresetKind,
  resolveWorkflowKind,
  resolveMutationPresetKey,
  workflowPresetKinds,
  listCrudPresetKeys,
  listCrudPresets,
  parseMutationPresetKey,
  presetKeyFor,
  authorWorkflowGraph,
  createStepGraph,
  createWorkflowGraph,
  ensureAspectGraph,
  rollupParentStatusGraph,
  thinkingGraph,
  goalPlanningGraph,
  assistantTurnGraph,
  recruitAgentGraph,
  knowledgeCaptureGraph,
  knowledgeClassifyGraph,
  knowledgeRetrieveGraph,
  authorWorkflowPreset,
  createStepPreset,
  createWorkflowPreset,
  ensureAspectPreset,
  nextWorkPreset,
  onboardingPreset,
  rollupParentStatusPreset,
  thinkingPreset,
  goalPlanningPreset,
  assistantTurnPreset,
  recruitAgentPreset,
  knowledgeCapturePreset,
  knowledgeClassifyPreset,
  knowledgeRetrievePreset
};

export default presets;

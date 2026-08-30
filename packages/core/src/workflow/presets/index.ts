import { authorWorkflowPreset } from "./author-workflow";
import { createStepPreset } from "./create-step";
import { createWorkflowPreset } from "./create-workflow";
import { ensureAspectPreset } from "./ensure-aspect";
import { listCrudPresets, parseMutationPresetKey, presetKeyFor } from "./crud";
import { nextWorkPreset } from "./next-work";
import { onboardingPreset } from "./onboarding";
import { rollupParentStatusPreset } from "./rollup-parent-status";
import { thinkingPreset } from "./thinking";
import { goalPlanningPreset } from "./goal-planning";
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
export { authorWorkflowGraph, authorWorkflowPreset } from "./author-workflow";
export { createStepGraph, createStepPreset } from "./create-step";
export { createWorkflowGraph, createWorkflowPreset } from "./create-workflow";
export { ensureAspectGraph, ensureAspectPreset } from "./ensure-aspect";
export {
  listCrudPresetKeys,
  listCrudPresets,
  parseMutationPresetKey,
  presetKeyFor,
  type MutationOp
} from "./crud";
export { nextWorkPreset } from "./next-work";
export { onboardingPreset } from "./onboarding";
export { rollupParentStatusGraph, rollupParentStatusPreset } from "./rollup-parent-status";
export { thinkingGraph, thinkingPreset } from "./thinking";
export { goalPlanningGraph, goalPlanningPreset } from "./goal-planning";

/** Seeded packs: mutation/rollup plus the pin-variable proof graph. */
export function listWorkflowPresets(): WorkflowPreset[] {
  return [
    ...listCrudPresets(),
    rollupParentStatusPreset,
    createStepPreset,
    createWorkflowPreset,
    thinkingPreset,
    goalPlanningPreset
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

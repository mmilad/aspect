import { ensureAspectPreset } from "./ensure-aspect";
import { listCrudPresets, parseMutationPresetKey, presetKeyFor } from "./crud";
import { nextWorkPreset } from "./next-work";
import { onboardingPreset } from "./onboarding";
import { rollupParentStatusPreset } from "./rollup-parent-status";
import type { WorkflowPreset } from "./types";

export type {
  EnsureWorkflowPresetsOptions,
  EnsureWorkflowPresetsResult,
  WorkflowPreset
} from "./types";
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

/** All shipped workflow packs (seed-once into SQLite). */
export function listWorkflowPresets(): WorkflowPreset[] {
  return [
    ensureAspectPreset,
    ...listCrudPresets(),
    nextWorkPreset,
    onboardingPreset,
    rollupParentStatusPreset
  ];
}

export function getWorkflowPreset(presetKey: string): WorkflowPreset | undefined {
  return listWorkflowPresets().find((preset) => preset.presetKey === presetKey);
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

import { ensureAspectPreset } from "./ensure-aspect";
import type { WorkflowPreset } from "./types";

export type {
  EnsureWorkflowPresetsOptions,
  EnsureWorkflowPresetsResult,
  WorkflowPreset
} from "./types";
export { ensureAspectGraph, ensureAspectPreset } from "./ensure-aspect";

/** All shipped workflow packs (seed-once into SQLite). */
export function listWorkflowPresets(): WorkflowPreset[] {
  return [ensureAspectPreset];
}

export function getWorkflowPreset(presetKey: string): WorkflowPreset | undefined {
  return listWorkflowPresets().find((preset) => preset.presetKey === presetKey);
}

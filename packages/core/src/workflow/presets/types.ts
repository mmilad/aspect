import type { EntityStatus } from "../../domain/types";
import type { WorkflowGraph } from "../graph";

/** Closed role for packs and seeded Flow entities. Not a freeform tag. */
export const workflowPresetKinds = [
  "mutation",
  "builder",
  "housekeeping",
  "orientation",
  "user"
] as const;

export type WorkflowPresetKind = (typeof workflowPresetKinds)[number];

/** Pack definition shipped in-repo; copied into SQLite once (or force-reseed). */
export interface WorkflowPreset {
  /** Stable install key, e.g. "ensure_aspect". */
  presetKey: string;
  /** Bump when the pack graph/copy changes. */
  presetVersion: number;
  title: string;
  summary: string;
  /** When/how agents should use this workflow. */
  body?: string;
  status?: EntityStatus;
  kind: WorkflowPresetKind;
  graph: WorkflowGraph;
  /** Optional Aspect/Feature slug or key (e.g. FEAT-24) to link via supports at install. */
  supportsTargetSlug?: string;
  /**
   * When false, hosts must not drain pending_llm in one HTTP call.
   * Omitted/true: Run may send drainLlm (Thinking, create_workflow, …).
   */
  drainLlm?: boolean;
}

export interface EnsureWorkflowPresetsOptions {
  projectKey?: string;
  /** Replace graphs for matching preset keys (dev). */
  force?: boolean;
  /** Limit to these presetKeys. */
  only?: string[];
}

export interface EnsureWorkflowPresetsResult {
  seeded: string[];
  skipped: string[];
  reseeded: string[];
  warnings: string[];
}

import type { EntityStatus } from "../../domain/types";
import type { WorkflowGraph } from "../types";

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
  graph: WorkflowGraph;
  /** Optional Aspect/Feature slug to link via supports at install. */
  supportsTargetSlug?: string;
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

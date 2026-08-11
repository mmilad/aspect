import type { EntityType } from "../../domain/types";
import type { WorkflowGraph } from "../graph/types";

export interface WorkflowMatch {
  id: string;
  type: EntityType;
  title: string;
  status: string;
  summary?: string;
  score?: number;
  [key: string]: unknown;
}

export interface WorkflowToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface WorkflowToolResult {
  values: Record<string, unknown>;
}

export interface WorkflowWriteCall {
  action: "create_entity" | "update_entity" | "rollup_parent_status";
  args: Record<string, unknown>;
}

export type WorkflowFunctionHandler = (
  args: Record<string, unknown>
) => Promise<WorkflowToolResult> | WorkflowToolResult;

export interface FunctionRegistry {
  [name: string]: WorkflowFunctionHandler;
}

export interface WorkflowAdapters {
  loadContext?: (input: {
    query: string;
    types?: EntityType[];
    limit: number;
    mode?: "query" | "all";
  }) => Promise<WorkflowMatch[]> | WorkflowMatch[];
  runTool?: (call: WorkflowToolCall) => Promise<WorkflowToolResult> | WorkflowToolResult;
  runWrite?: (call: WorkflowWriteCall) => Promise<WorkflowToolResult> | WorkflowToolResult;
  resolveInstruction?: (instructionRef: string) => Promise<string | null> | string | null;
  /** Resolve a nested workflow graph by id (subworkflow / foreach body). */
  resolveSubworkflow?: (
    workflowId: string
  ) => Promise<WorkflowGraph | null> | WorkflowGraph | null;
  /** Optional tag ids marked business-critical for workScore light signals. */
  criticalTaggedIds?: Set<string>;
  /**
   * Named functions shared with the prompt appendix. When `runTool` is omitted,
   * tool nodes resolve through this registry by name.
   */
  functions?: FunctionRegistry;
}

/** Merge registries; later entries override earlier ones. */
export function createFunctionRegistry(
  ...parts: Array<FunctionRegistry | undefined>
): FunctionRegistry {
  const merged: FunctionRegistry = {};
  for (const part of parts) {
    if (!part) {
      continue;
    }
    Object.assign(merged, part);
  }
  return merged;
}

/**
 * Build adapters that route tool/write calls through a FunctionRegistry.
 * Existing `runTool` / `runWrite` on `base` take precedence when provided.
 */
export function adaptersFromRegistry(
  registry: FunctionRegistry,
  base: Omit<WorkflowAdapters, "functions"> = {}
): WorkflowAdapters {
  return {
    ...base,
    functions: registry,
    runTool:
      base.runTool ??
      (async (call) => {
        const handler = registry[call.name];
        if (!handler) {
          throw new Error(`No function registered for tool '${call.name}'.`);
        }
        return handler(call.args);
      }),
    runWrite:
      base.runWrite ??
      (async (call) => {
        const handler = registry[call.action];
        if (!handler) {
          throw new Error(`No function registered for write '${call.action}'.`);
        }
        return handler(call.args);
      })
  };
}

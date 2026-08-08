/** Shared compiled IR for workflow → prompt and workflow → runtime targets. */

export type CompiledStep =
  | { kind: "goal"; text: string }
  | { kind: "instruction"; text: string; nodeId: string }
  | {
      kind: "function";
      name: string;
      params: Record<string, unknown>;
      resultHint?: string;
      nodeId: string;
    }
  | {
      kind: "llm";
      instructions: string;
      tools?: string[];
      inputKeys?: string[];
      outputSchema?: string[];
      nodeId: string;
    }
  | { kind: "constraint"; text: string; nodeId?: string }
  | {
      kind: "branch";
      condition: string;
      whenTrue?: string;
      whenFalse?: string;
      routes?: Record<string, string>;
      nodeId: string;
    }
  | {
      kind: "write";
      action: string;
      args: Record<string, unknown>;
      nodeId: string;
    }
  /** Reserved for a later schema extension. */
  | { kind: "loop"; nodeId: string; note?: string }
  /** Reserved for a later schema extension. */
  | { kind: "subworkflow"; workflowRef: string; nodeId: string };

export interface CompiledFunctionDecl {
  name: string;
  description?: string;
}

export interface CompiledWorkflow {
  version: 1;
  title?: string;
  goal?: string;
  steps: CompiledStep[];
  functions: CompiledFunctionDecl[];
}

export interface CompileOptions {
  /** Override goal text used for the opening step (defaults to placeholder). */
  goal?: string;
  /** Optional workflow title for the playbook header. */
  title?: string;
  /** Extra function descriptions merged into the catalog. */
  functionCatalog?: CompiledFunctionDecl[];
}

export const BUILTIN_FUNCTION_DESCRIPTIONS: Record<string, string> = {
  loadContext: "Load matching entities from the Aspect Graph into the context bag.",
  filter: "Filter and optionally project keys from a bag array.",
  rankTaskCandidates: "Rank open, unblocked tasks by workScore.",
  assign: "Write literal values into the context bag.",
  pickFirst: "Pick the first item from a bag array.",
  neighborhoodOf: "Build a 1-hop neighborhood around a selected entity.",
  composeTaskPrompt: "Compose an agent handoff prompt from a task and neighborhood context.",
  create_entity: "Create a Projectplaner entity.",
  update_entity: "Update fields on an existing entity."
};

import type { WorkflowContextBag, WorkflowGraph } from "../../../workflow";
import type { CompiledWorkflow } from "../types";

export interface PromptRenderOptions {
  /** Override / fill goal text in the playbook header. */
  goal?: string;
  /** Optional title line. */
  title?: string;
  /**
   * Optional bag slice for LLM context. Only keys listed as LLM inputKeys / reads
   * are included when `bag` is provided (never the whole bag).
   */
  bag?: WorkflowContextBag;
  /** When true, omit the Available functions appendix. */
  omitFunctionsAppendix?: boolean;
}

export type WorkflowPromptInput = WorkflowGraph | CompiledWorkflow;

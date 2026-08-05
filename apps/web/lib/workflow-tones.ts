import type { WorkflowNodeType } from "@projectplaner/core";

export const workflowStepToneByType: Record<WorkflowNodeType, string> = {
  start: "border-zinc-700 bg-zinc-900 text-white",
  end: "border-zinc-500 bg-zinc-700 text-white",
  context: "border-cyan-600 bg-cyan-50 text-cyan-950",
  filter: "border-teal-600 bg-teal-50 text-teal-950",
  tool: "border-indigo-600 bg-indigo-50 text-indigo-950",
  llm: "border-amber-500 bg-amber-50 text-amber-950",
  write: "border-emerald-600 bg-emerald-50 text-emerald-950",
  gate: "border-rose-500 bg-rose-50 text-rose-950"
};

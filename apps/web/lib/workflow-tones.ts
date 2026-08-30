import type { WorkflowNodeType } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { workflowControlNodeTypes, workflowVariableNodeTypes, workflowWorkNodeTypes } = workflow.nodes;

export const workflowStepToneByType: Record<WorkflowNodeType, string> = {
  start: "border-zinc-700 bg-zinc-900 text-white",
  end: "border-zinc-500 bg-zinc-700 text-white",
  error_end: "border-rose-800 bg-rose-900 text-white",
  switch: "border-violet-600 bg-violet-50 text-violet-950",
  branch: "border-fuchsia-600 bg-fuchsia-50 text-fuchsia-950",
  fork: "border-sky-600 bg-sky-50 text-sky-950",
  join: "border-sky-700 bg-sky-100 text-sky-950",
  foreach: "border-fuchsia-600 bg-fuchsia-50 text-fuchsia-950",
  gate: "border-rose-500 bg-rose-50 text-rose-950",
  wait: "border-slate-500 bg-slate-50 text-slate-900",
  subworkflow: "border-purple-600 bg-purple-50 text-purple-950",
  tool: "border-indigo-600 bg-indigo-50 text-indigo-950",
  llm: "border-amber-500 bg-amber-50 text-amber-950",
  context: "border-cyan-600 bg-cyan-50 text-cyan-950",
  transform: "border-teal-600 bg-teal-50 text-teal-950",
  map: "border-lime-600 bg-lime-50 text-lime-950",
  math: "border-green-600 bg-green-50 text-green-950",
  query: "border-cyan-700 bg-cyan-50 text-cyan-950",
  write: "border-emerald-600 bg-emerald-50 text-emerald-950",
  push: "border-emerald-700 bg-emerald-50 text-emerald-950",
  create_workflow_node: "border-sky-700 bg-sky-50 text-sky-950",
  assemble_fragment: "border-sky-800 bg-sky-100 text-sky-950",
  assistant_session: "border-cyan-800 bg-cyan-50 text-cyan-950",
  assistant_window: "border-teal-700 bg-teal-50 text-teal-950",
  get: "border-pink-600 bg-pink-50 text-pink-950",
  set: "border-pink-700 bg-pink-100 text-pink-950",
  template: "border-pink-500 bg-pink-50 text-pink-950",
  reroute: "border-stone-600 bg-stone-50 text-stone-900"
};

export const workflowPaletteGroups: Array<{ label: string; types: readonly WorkflowNodeType[] }> = [
  { label: "Control", types: workflowControlNodeTypes },
  { label: "Work", types: workflowWorkNodeTypes },
  { label: "Variables", types: workflowVariableNodeTypes }
];

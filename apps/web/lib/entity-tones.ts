/** Badge chip tones keyed by entity type. */
export const badgeToneByType: Record<string, string> = {
  project: "bg-zinc-900 text-white",
  aspect: "bg-teal-700 text-white",
  entry: "bg-teal-700 text-white",
  area: "bg-slate-700 text-white",
  surface: "bg-cyan-700 text-white",
  feature: "bg-emerald-700 text-white",
  flow: "bg-indigo-700 text-white",
  decision: "bg-amber-600 text-white",
  question: "bg-rose-700 text-white",
  reference: "bg-stone-700 text-white",
  task: "bg-sky-800 text-white",
  task_group: "bg-violet-700 text-white"
};

/** Aspect-graph dot fill tones keyed by entity type. */
export const graphDotToneByType: Record<string, string> = {
  project: "bg-zinc-900",
  aspect: "bg-teal-600",
  entry: "bg-lime-600",
  area: "bg-slate-600",
  surface: "bg-cyan-600",
  feature: "bg-emerald-600",
  flow: "bg-indigo-600",
  decision: "bg-amber-500",
  question: "bg-rose-600",
  reference: "bg-stone-600",
  task: "bg-sky-600",
  task_group: "bg-violet-600"
};

/** Aspect-graph dot ring tones keyed by status. */
export const graphDotStatusByStatus: Record<string, string> = {
  not_implemented: "border-slate-400",
  planned: "border-slate-400",
  todo: "border-slate-400",
  in_work: "border-cyan-500 ring-2 ring-cyan-200",
  doing: "border-cyan-500 ring-2 ring-cyan-200",
  review: "border-amber-500 ring-2 ring-amber-200",
  blocked: "border-rose-600 ring-2 ring-rose-200",
  implemented: "border-emerald-500 ring-2 ring-emerald-200",
  done: "border-emerald-500 ring-2 ring-emerald-200",
  accepted: "border-amber-500 ring-2 ring-amber-200",
  answered: "border-emerald-500 ring-2 ring-emerald-200",
  active: "border-teal-500 ring-2 ring-teal-200",
  archived: "border-stone-300 opacity-50"
};

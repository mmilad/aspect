import { cn } from "../lib/utils";

const toneByType: Record<string, string> = {
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
  task_group: "bg-violet-700 text-white"
};

export function Badge({ children, tone, className }: { children: React.ReactNode; tone?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        tone ? (toneByType[tone] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

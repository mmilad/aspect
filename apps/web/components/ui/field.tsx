import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Field({
  label,
  value,
  className
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border bg-white px-3 py-2", className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-zinc-800">{value}</div>
    </div>
  );
}

export function Metric({
  label,
  value,
  className
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border bg-white px-2.5 py-2", className)}>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

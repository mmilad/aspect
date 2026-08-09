interface OperationalPaneProps {
  title: string;
  purpose: string;
}

/** Dense empty stub for operational Project Tabs (Issues / Kanban) until FEAT depth lands. */
export function OperationalPane({ title, purpose }: OperationalPaneProps) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-[#f8faf9] p-4">
      <div className="text-sm font-medium text-zinc-900">{title}</div>
      <p className="mt-1 max-w-xl text-xs text-muted-foreground">{purpose}</p>
      <div className="mt-4 flex flex-1 items-start border border-dashed border-zinc-300 bg-white px-3 py-6">
        <p className="text-sm text-muted-foreground">No rows yet — operational placeholder.</p>
      </div>
    </section>
  );
}

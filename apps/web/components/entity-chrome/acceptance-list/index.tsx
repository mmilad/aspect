interface AcceptanceListProps {
  items: string[];
  empty?: string | null;
  title?: string;
}

export function AcceptanceList({ items, empty = "None.", title = "Acceptance criteria" }: AcceptanceListProps) {
  return (
    <section className="rounded-md border border-border bg-white p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        empty === null ? null : <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

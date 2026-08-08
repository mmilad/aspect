import type { Entity } from "@projectplaner/core";
import { EntityLink } from "../../ui";

interface EntityListPanelProps {
  title: string;
  entities: Entity[];
  projectKey: string;
  empty: string;
}

export function EntityListPanel({ title, entities, projectKey, empty }: EntityListPanelProps) {
  return (
    <section className="rounded-md border border-border bg-white p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {entities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {entities.map((entity) => (
            <li key={entity.id} className="rounded-md border border-border px-2.5 py-2">
              <EntityLink projectKey={projectKey} entity={entity} />
              {entity.summary ? <p className="mt-1 text-xs text-muted-foreground">{entity.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

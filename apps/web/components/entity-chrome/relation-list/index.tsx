import type { Entity, EntityRelation } from "@projectplaner/core";
import { EntityLink } from "../../ui";

export type RelationListItem = {
  relation: EntityRelation;
  direction: "outgoing" | "incoming";
  other: Entity | null;
};

interface RelationListProps {
  title: string;
  items: RelationListItem[];
  projectKey: string;
}

export function RelationList({ title, items, projectKey }: RelationListProps) {
  return (
    <section className="rounded-md border border-border bg-white p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ relation, direction, other }) => (
            <li key={relation.id} className="rounded-md border border-border px-2.5 py-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {relation.type}
                {relation.label ? ` · ${relation.label}` : ""}
                {relation.isPrimary ? " · primary" : ""}
              </div>
              {other ? (
                <EntityLink projectKey={projectKey} entity={other} />
              ) : (
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {direction === "outgoing" ? relation.targetEntityId : relation.sourceEntityId}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

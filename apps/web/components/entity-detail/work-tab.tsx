import type { Entity } from "@projectplaner/core";
import { EntityLink, Field, ToolbarLink } from "../ui";
import { AcceptanceList, EntityListPanel, RelationList, type RelationListItem } from "../entity-chrome";
import { formatStatus } from "../../lib/entity-label";
import { projectPaths } from "../../lib/project-paths";

interface WorkTabProps {
  entity: Entity;
  projectKey: string;
  relatedWork: Entity[];
  dependencies: RelationListItem[];
  dependents: RelationListItem[];
  acceptanceCriteria: string[];
  priority: string | null;
  primary?: RelationListItem;
}

export function WorkTab({
  entity,
  projectKey,
  relatedWork,
  dependencies,
  dependents,
  acceptanceCriteria,
  priority,
  primary
}: WorkTabProps) {
  if (entity.type === "task") {
    return (
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Status" value={formatStatus(entity.status)} />
          <Field label="Priority" value={priority ?? "—"} />
        </section>

        <section className="rounded-md border border-border bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary relation</h2>
          {primary?.other ? (
            <div className="flex flex-wrap items-center gap-2">
              <EntityLink projectKey={projectKey} entity={primary.other} relationType={primary.relation.type} />
              <ToolbarLink href={projectPaths.graph(projectKey, primary.other.id)} size="xs">
                Open graph
              </ToolbarLink>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No primary relation.</p>
          )}
        </section>

        <AcceptanceList items={acceptanceCriteria} />

        <div className="grid gap-4 md:grid-cols-2">
          <RelationList title="Depends on / blocked by" items={dependencies} projectKey={projectKey} />
          <RelationList title="Depended on by" items={dependents} projectKey={projectKey} />
        </div>
      </div>
    );
  }

  return (
    <EntityListPanel
      title="Related work"
      entities={relatedWork}
      projectKey={projectKey}
      empty="No related tasks or features."
    />
  );
}

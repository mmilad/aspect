import type { Entity } from "@projectplaner/core";
import { EntityLink, Field, ToolbarLink } from "../ui";
import { AcceptanceList, RelationList, TagList, type RelationListItem } from "../entity-chrome";
import { TaskCanceledToggle } from "../task-canceled-toggle";
import { formatStatus } from "../../lib/entity-label";
import { projectPaths } from "../../lib/project-paths";
import type { Tag } from "@projectplaner/core";

interface OverviewTabProps {
  entity: Entity;
  tags: Tag[];
  primary?: RelationListItem;
  projectKey: string;
  priority: string | null;
  acceptanceCriteria: string[];
}

export function OverviewTab({
  entity,
  tags,
  primary,
  projectKey,
  priority,
  acceptanceCriteria
}: OverviewTabProps) {
  const isTask = entity.type === "task";

  return (
    <div className="space-y-4">
      {entity.type === "flow" ? (
        <section className="rounded-md border border-indigo-200 bg-indigo-50/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Workflow Step Graph</div>
          <p className="mt-1 text-sm text-indigo-950/80">
            Author executable steps separately from the Aspect Graph. Stored on this flow as{" "}
            <span className="font-mono text-xs">metadata.graph</span>.
          </p>
          <ToolbarLink href={projectPaths.flow(projectKey, entity.id)} className="mt-2" tone="workflow">
            Open workflow editor
          </ToolbarLink>
        </section>
      ) : null}

      {isTask ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Field label="Status" value={formatStatus(entity.status)} />
          <Field label="Priority" value={priority ?? "—"} />
          <Field
            label="Primary link"
            value={
              primary?.other ? (
                <EntityLink projectKey={projectKey} entity={primary.other} relationType={primary.relation.type} />
              ) : (
                "—"
              )
            }
          />
        </section>
      ) : null}

      {isTask ? <TaskCanceledToggle entityId={entity.id} metadata={entity.metadata} /> : null}

      {entity.body ? (
        <section className="rounded-md border border-border bg-white p-4 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">
          {entity.body}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No body.</p>
      )}

      {isTask && acceptanceCriteria.length > 0 ? (
        <AcceptanceList items={acceptanceCriteria} empty={null} />
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h2>
        <TagList tags={tags} />
      </section>

      <p className="font-mono text-xs text-muted-foreground">{entity.id}</p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { Entity, JsonRecord } from "@projectplaner/core";
import { Badge } from "../../../../../components/badge";
import { ProjectLeftSidebar } from "../../../../../components/project-left-sidebar";
import { ProjectShell } from "../../../../../components/project-shell";
import { SelectionInspector } from "../../../../../components/selection-inspector";
import { WorkspaceCenter } from "../../../../../components/workspace-center";
import { cn } from "../../../../../lib/utils";
import {
  loadProject,
  loadEntityDetail,
  type EntityDetailData,
  type EntityDetailRelation
} from "../../../../../lib/data";

const DETAIL_TABS = ["overview", "work", "relations", "notes", "metadata"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function isDetailTab(value: string | undefined): value is DetailTab {
  return DETAIL_TABS.includes(value as DetailTab);
}

export default async function EntityDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ projectKey: string; entityId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectKey, entityId } = await params;
  const query = await searchParams;
  const tab = isDetailTab(query.tab) ? query.tab : "overview";
  const detail = await loadEntityDetail(projectKey, entityId);
  const snapshot = await loadProject(projectKey);

  if (!detail || !snapshot) {
    notFound();
  }

  const { project, entity } = detail;
  const rootNode = snapshot.nodes[0];
  const selectedNode = snapshot.nodes.find((node) => node.id === entity.id) ?? rootNode;
  const selectedFeature = snapshot.features.find((feature) => feature.id === entity.id) ?? null;
  const priority = readString(entity.metadata.priority);
  const acceptanceCriteria = readStringList(entity.metadata.acceptanceCriteria);
  const primary = detail.relations.find((item) => item.relation.isPrimary && item.direction === "outgoing");
  const dependencies = detail.relations.filter(
    (item) => item.direction === "outgoing" && (item.relation.type === "depends_on" || item.relation.type === "blocked_by")
  );
  const dependents = detail.relations.filter(
    (item) => item.direction === "incoming" && (item.relation.type === "depends_on" || item.relation.type === "blocked_by")
  );

  const center = (
    <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={entity.type}>{entity.type.replace("_", " ")}</Badge>
          <Badge>{entity.status.replace("_", " ")}</Badge>
          {priority ? <Badge>{priority}</Badge> : null}
          {entity.key ? <Badge>{entity.key}</Badge> : null}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{entity.title}</h1>
        {entity.summary ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{entity.summary}</p> : null}

        <div className="-mx-4 mt-5 overflow-x-auto border-y border-border px-4 sm:mx-0 sm:rounded-md sm:border sm:px-0">
          <nav className="flex min-w-max gap-1 p-1" aria-label="Entity detail sections">
            {DETAIL_TABS.map((item) => (
              <Link
                key={item}
                href={`/projects/${project.key}/entities/${entity.id}?tab=${item}`}
                className={cn(
                  "rounded-md px-3 py-2 text-sm capitalize",
                  tab === item ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-5">
          {tab === "overview" ? (
            <OverviewTab
              entity={entity}
              tags={detail.tags}
              primary={primary}
              projectKey={project.key}
              isTask={entity.type === "task"}
              priority={priority}
              acceptanceCriteria={acceptanceCriteria}
            />
          ) : null}
          {tab === "work" ? (
            <WorkTab
              entity={entity}
              projectKey={project.key}
              relatedWork={detail.relatedWork}
              dependencies={dependencies}
              dependents={dependents}
              acceptanceCriteria={acceptanceCriteria}
              priority={priority}
              primary={primary}
            />
          ) : null}
          {tab === "relations" ? (
            <RelationsTab relations={detail.relations} projectKey={project.key} />
          ) : null}
          {tab === "notes" ? (
            <NotesTab notes={detail.notes} references={detail.references} projectKey={project.key} />
          ) : null}
          {tab === "metadata" ? <MetadataTab metadata={entity.metadata} /> : null}
        </div>
      </div>
  );

  return (
    <ProjectShell
      project={project}
      scopeLabel={`${entity.type}${entity.key ? ` / ${entity.key}` : ""} / ${entity.title}`}
      activeView="entity"
      leftSidebar={<ProjectLeftSidebar snapshot={snapshot} activeView="entity" centerNode={selectedNode} recentScopes={selectedNode ? [selectedNode] : []} />}
      center={<WorkspaceCenter scroll>{center}</WorkspaceCenter>}
      rightSidebar={
        <SelectionInspector
          projectKey={project.key}
          center={selectedNode ?? rootNode}
          node={selectedNode ?? rootNode}
          entity={entity}
          feature={selectedFeature}
          tags={detail.tags}
          incomingCount={detail.relations.filter((item) => item.direction === "incoming").length}
          outgoingCount={detail.relations.filter((item) => item.direction === "outgoing").length}
        />
      }
    />
  );
}

function OverviewTab({
  entity,
  tags,
  primary,
  projectKey,
  isTask,
  priority,
  acceptanceCriteria
}: {
  entity: Entity;
  tags: EntityDetailData["tags"];
  primary?: EntityDetailRelation;
  projectKey: string;
  isTask: boolean;
  priority: string | null;
  acceptanceCriteria: string[];
}) {
  return (
    <div className="space-y-4">
      {entity.type === "flow" ? (
        <section className="rounded-md border border-indigo-200 bg-indigo-50/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Workflow Step Graph</div>
          <p className="mt-1 text-sm text-indigo-950/80">
            Author executable steps separately from the Aspect Graph. Stored on this flow as{" "}
            <span className="font-mono text-xs">metadata.graph</span>.
          </p>
          <Link
            href={`/projects/${projectKey}/flows/${entity.id}`}
            className="mt-2 inline-flex rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800"
          >
            Open workflow editor
          </Link>
        </section>
      ) : null}

      {isTask ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Field label="Status" value={entity.status} />
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

      {entity.body ? (
        <section className="rounded-md border border-border bg-white p-4 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">
          {entity.body}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No body.</p>
      )}

      {isTask && acceptanceCriteria.length > 0 ? (
        <section className="rounded-md border border-border bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceptance criteria</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {acceptanceCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag.id}>{tag.label}</Badge>
            ))}
          </div>
        )}
      </section>

      <p className="font-mono text-xs text-muted-foreground">{entity.id}</p>
    </div>
  );
}

function WorkTab({
  entity,
  projectKey,
  relatedWork,
  dependencies,
  dependents,
  acceptanceCriteria,
  priority,
  primary
}: {
  entity: Entity;
  projectKey: string;
  relatedWork: Entity[];
  dependencies: EntityDetailRelation[];
  dependents: EntityDetailRelation[];
  acceptanceCriteria: string[];
  priority: string | null;
  primary?: EntityDetailRelation;
}) {
  if (entity.type === "task") {
    return (
      <div className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Status" value={entity.status} />
          <Field label="Priority" value={priority ?? "—"} />
        </section>

        <section className="rounded-md border border-border bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary relation</h2>
          {primary?.other ? (
            <EntityLink projectKey={projectKey} entity={primary.other} relationType={primary.relation.type} />
          ) : (
            <p className="text-sm text-muted-foreground">No primary relation.</p>
          )}
        </section>

        <section className="rounded-md border border-border bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceptance criteria</h2>
          {acceptanceCriteria.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {acceptanceCriteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <RelationList title="Depends on / blocked by" items={dependencies} projectKey={projectKey} />
          <RelationList title="Depended on by" items={dependents} projectKey={projectKey} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-white p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related work</h2>
        {relatedWork.length === 0 ? (
          <p className="text-sm text-muted-foreground">No related tasks or features.</p>
        ) : (
          <ul className="space-y-2">
            {relatedWork.map((item) => (
              <li key={item.id}>
                <EntityLink projectKey={projectKey} entity={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RelationsTab({ relations, projectKey }: { relations: EntityDetailRelation[]; projectKey: string }) {
  const outgoing = relations.filter((item) => item.direction === "outgoing");
  const incoming = relations.filter((item) => item.direction === "incoming");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RelationList title="Outgoing" items={outgoing} projectKey={projectKey} />
      <RelationList title="Incoming" items={incoming} projectKey={projectKey} />
    </div>
  );
}

function NotesTab({
  notes,
  references,
  projectKey
}: {
  notes: Entity[];
  references: Entity[];
  projectKey: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <EntityListPanel title="Notes / entries" entities={notes} projectKey={projectKey} empty="No linked notes yet." />
      <EntityListPanel
        title="References"
        entities={references}
        projectKey={projectKey}
        empty="No linked references."
      />
    </div>
  );
}

function MetadataTab({ metadata }: { metadata: JsonRecord }) {
  return (
    <pre className="overflow-auto rounded-md border border-border bg-zinc-950 px-3 py-3 text-xs leading-5 text-zinc-100">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

function RelationList({
  title,
  items,
  projectKey
}: {
  title: string;
  items: EntityDetailRelation[];
  projectKey: string;
}) {
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

function EntityListPanel({
  title,
  entities,
  projectKey,
  empty
}: {
  title: string;
  entities: Entity[];
  projectKey: string;
  empty: string;
}) {
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

function EntityLink({
  projectKey,
  entity,
  relationType
}: {
  projectKey: string;
  entity: Entity;
  relationType?: string;
}) {
  return (
    <Link className="font-medium text-teal-800 hover:underline" href={`/projects/${projectKey}/entities/${entity.id}`}>
      {relationType ? `${relationType} · ` : ""}
      {entity.type}
      {entity.key ? ` · ${entity.key}` : ""} · {entity.title}
    </Link>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-zinc-800">{value}</div>
    </div>
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

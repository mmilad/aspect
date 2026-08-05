"use client";

import Link from "next/link";
import { LocateFixed, PanelRight } from "lucide-react";
import type { Feature, ProjectNode, ProjectPlanSnapshot, Task } from "@projectplaner/core";
import { Badge } from "../badge";
import styles from "./style.module.css";

export type PreviewEntity = {
  id: string;
  type: string;
  key?: string | null;
  title: string;
  summary?: string | null;
  body?: string | null;
  status: string;
  path?: string;
};

interface SelectionInspectorProps {
  projectKey: string;
  center: ProjectNode;
  node: ProjectNode;
  entity: PreviewEntity;
  feature: Feature | null;
  relatedFeatures?: Feature[];
  directTasks?: Task[];
  featureTasks?: Task[];
  subaspectTasks?: Task[];
  tags?: ProjectPlanSnapshot["tags"];
  incomingCount?: number;
  outgoingCount?: number;
  onCenter?: (id: string) => void;
}

export function SelectionInspector({
  projectKey,
  center,
  node,
  entity,
  feature,
  relatedFeatures = [],
  directTasks = [],
  featureTasks = [],
  subaspectTasks = [],
  tags = [],
  incomingCount = 0,
  outgoingCount = 0,
  onCenter
}: SelectionInspectorProps) {
  const isAspect = entity.type === "aspect";
  const selectedTitle = feature?.title ?? entity.title;
  const selectedSummary = feature?.summary ?? entity.summary;
  const selectedStatus = feature?.status ?? entity.status;
  const selectedKey = feature?.key ?? entity.key;
  const taskCount = directTasks.length + featureTasks.length + subaspectTasks.length;

  return (
    <div className={styles.inspector}>
      <div className={styles.top}>
        <div className={styles.eyebrow}>
          <PanelRight className="h-4 w-4" />
          Preview
        </div>
        <div className="flex items-center gap-2">
          {isAspect ? (
            <button className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted" onClick={() => onCenter?.(node.id)}>
              <LocateFixed className="h-3.5 w-3.5" />
              Center
            </button>
          ) : null}
          {entity.type === "flow" ? (
            <Link
              className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-xs text-indigo-900 hover:bg-indigo-100"
              href={`/projects/${projectKey}/flows/${entity.id}`}
            >
              Workflow
            </Link>
          ) : null}
          <Link className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted" href={`/projects/${projectKey}/entities/${feature?.id ?? entity.id}`}>
            Open detail
          </Link>
        </div>
      </div>

      {isAspect && center.id !== node.id ? (
        <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
          Scope is centered on <strong>{center.title}</strong>.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={feature ? "feature" : entity.type}>{feature ? "feature" : entity.type.replace("_", " ")}</Badge>
        <Badge>{selectedStatus.replace("_", " ")}</Badge>
        {selectedKey ? <Badge>{selectedKey}</Badge> : null}
      </div>
      <h1 className={styles.title}>{selectedTitle}</h1>
      {entity.path ? <div className="mt-2 truncate rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-muted-foreground">{entity.path}</div> : null}
      {selectedSummary ? <p className={styles.summary}>{selectedSummary}</p> : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Work Signal</div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Tasks" value={taskCount} />
          <Metric label="Features" value={feature ? relatedFeatures.length : relatedFeatures.length} />
          <Metric label="Relations" value={incomingCount + outgoingCount} />
        </div>
      </section>

      {relatedFeatures.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Linked Features</div>
          <div className="grid gap-2">
            {relatedFeatures.slice(0, 4).map((item) => (
              <Link key={item.id} className={styles.item} href={`/projects/${projectKey}/entities/${item.id}`}>
                <div className="font-medium text-zinc-900">{item.title}</div>
                <div className="mt-1 text-muted-foreground">{item.status.replace("_", " ")}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {taskCount > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Linked Tasks</div>
          <TaskPreviewList projectKey={projectKey} tasks={[...directTasks, ...featureTasks, ...subaspectTasks].slice(0, 5)} />
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Tags</div>
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
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.item}>
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function TaskPreviewList({ projectKey, tasks }: { projectKey: string; tasks: Task[] }) {
  return (
    <div className="grid gap-2">
      {tasks.map((task) => (
        <Link key={task.id} className={styles.item} href={`/projects/${projectKey}/entities/${task.id}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-zinc-900">{task.title}</span>
            <Badge>{task.status}</Badge>
          </div>
          <div className="mt-1 text-muted-foreground">{task.priority}</div>
        </Link>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { LocateFixed, PanelRight } from "lucide-react";
import type { Feature, JsonRecord, ProjectNode, ProjectPlanSnapshot, Task } from "@projectplaner/core";
import { Badge, GhostButton, ToolbarLink, Metric } from "../ui";
import { EntityHeader, TagList } from "../entity-chrome";
import { toEntityPreview, type EntityPreview } from "../../lib/entity-preview";
import { formatStatus } from "../../lib/entity-label";
import { projectPaths } from "../../lib/project-paths";
import styles from "./style.module.css";

export type PreviewEntity = EntityPreview & { metadata?: JsonRecord };

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
  const preview = toEntityPreview(
    feature
      ? {
          id: feature.id,
          type: "feature",
          key: feature.key,
          title: feature.title,
          summary: feature.summary,
          body: feature.body,
          status: feature.status,
          path: entity.path,
          metadata: feature.metadata
        }
      : {
          id: entity.id,
          type: entity.type,
          key: entity.key,
          title: entity.title,
          summary: entity.summary,
          body: entity.body,
          status: entity.status,
          path: entity.path,
          metadata: entity.metadata,
          priority: entity.priority
        }
  );
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
            <GhostButton size="xs" onClick={() => onCenter?.(node.id)}>
              <LocateFixed className="h-3.5 w-3.5" />
              Center
            </GhostButton>
          ) : null}
          {entity.type === "flow" ? (
            <ToolbarLink href={projectPaths.flow(projectKey, entity.id)} size="xs" tone="workflow">
              Workflow
            </ToolbarLink>
          ) : null}
          <ToolbarLink href={projectPaths.entity(projectKey, feature?.id ?? entity.id)} size="xs">
            Open detail
          </ToolbarLink>
        </div>
      </div>

      {isAspect && center.id !== node.id ? (
        <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
          Scope is centered on <strong>{center.title}</strong>.
        </div>
      ) : null}

      <EntityHeader
        entity={preview}
        extras={[preview.priority]}
        titleClassName={styles.title}
        summaryClassName={styles.summary}
      />

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Work Signal</div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Tasks" value={taskCount} className={styles.item} />
          <Metric label="Features" value={relatedFeatures.length} className={styles.item} />
          <Metric label="Relations" value={incomingCount + outgoingCount} className={styles.item} />
        </div>
      </section>

      {relatedFeatures.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Linked Features</div>
          <div className="grid gap-2">
            {relatedFeatures.slice(0, 4).map((item) => (
              <Link key={item.id} className={styles.item} href={projectPaths.entity(projectKey, item.id)}>
                <div className="font-medium text-zinc-900">{item.title}</div>
                <div className="mt-1 text-muted-foreground">{formatStatus(item.status)}</div>
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
        <TagList tags={tags} />
      </section>
    </div>
  );
}

function TaskPreviewList({ projectKey, tasks }: { projectKey: string; tasks: Task[] }) {
  return (
    <div className="grid gap-2">
      {tasks.map((task) => (
        <Link key={task.id} className={styles.item} href={projectPaths.entity(projectKey, task.id)}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-zinc-900">{task.title}</span>
            <Badge>{formatStatus(task.status)}</Badge>
          </div>
          <div className="mt-1 text-muted-foreground">{task.priority}</div>
        </Link>
      ))}
    </div>
  );
}

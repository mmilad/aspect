"use client";

import Link from "next/link";
import { CircleDot, Tags } from "lucide-react";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { ProjectView } from "../../lib/project-view";
import { projectPaths } from "../../lib/project-paths";
import { Badge } from "../ui/badge";
import styles from "./style.module.css";

export type ScopeEntry = {
  id: string;
  title: string;
  path?: string;
};

interface ScopeSectionProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  centerNode?: ProjectNode;
  /** Overrides center display (e.g. Kanban board scope, including features). */
  scopeCenter?: ScopeEntry | null;
  recentScopes?: ScopeEntry[];
  onOpenScope?: (id: string) => void;
}

function toEntry(node: ProjectNode): ScopeEntry {
  return { id: node.id, title: node.title, path: node.path };
}

function scopeHref(
  activeView: ProjectView,
  projectKey: string,
  scopeId: string,
  rootId: string | undefined
): string {
  if (activeView === "kanban") {
    if (rootId && scopeId === rootId) {
      return projectPaths.kanban(projectKey, { selected: scopeId });
    }
    return projectPaths.kanban(projectKey, { scope: scopeId, selected: scopeId });
  }
  if (activeView === "issues") {
    return projectPaths.issues(projectKey, scopeId);
  }
  return projectPaths.graph(projectKey, scopeId);
}

function ScopeRow({
  entry,
  activeView,
  projectKey,
  rootId,
  onOpenScope,
  emphasized
}: {
  entry: ScopeEntry;
  activeView: ProjectView;
  projectKey: string;
  rootId: string | undefined;
  onOpenScope?: (id: string) => void;
  emphasized?: boolean;
}) {
  const content = emphasized ? (
    <span className="inline-flex min-w-0 items-center gap-2">
      <CircleDot className="h-3.5 w-3.5 shrink-0 text-teal-700" />
      <span className="truncate">{entry.title}</span>
    </span>
  ) : (
    entry.title
  );

  if (onOpenScope) {
    return (
      <button
        type="button"
        className={styles.scopeItem}
        title={entry.path ?? entry.title}
        onClick={() => onOpenScope(entry.id)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      className={styles.scopeItem}
      href={scopeHref(activeView, projectKey, entry.id, rootId)}
      title={entry.path ?? entry.title}
    >
      {content}
    </Link>
  );
}

export function ScopeSection({
  snapshot,
  activeView,
  centerNode,
  scopeCenter = null,
  recentScopes = [],
  onOpenScope
}: ScopeSectionProps) {
  const center = scopeCenter ?? (centerNode ? toEntry(centerNode) : null);
  const recent = recentScopes
    .filter((scope) => scope.id !== center?.id)
    .filter((scope, index, list) => list.findIndex((item) => item.id === scope.id) === index)
    .slice(0, 5);
  const projectKey = snapshot.project.key;
  const rootId = snapshot.nodes[0]?.id;

  return (
    <>
      <section className={styles.section}>
        <div className={styles.heading}>Scope</div>
        {center ? (
          <ScopeRow
            entry={center}
            activeView={activeView}
            projectKey={projectKey}
            rootId={rootId}
            onOpenScope={onOpenScope}
            emphasized
          />
        ) : null}
        {recent.length > 0 ? (
          <div className="mt-2 grid gap-1">
            {recent.map((scope) => (
              <ScopeRow
                key={scope.id}
                entry={scope}
                activeView={activeView}
                projectKey={projectKey}
                rootId={rootId}
                onOpenScope={onOpenScope}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.heading}>Inventory</div>
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Tags className="h-3.5 w-3.5" />
              Tags
            </span>
            <Badge>{snapshot.tags.length}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Draft plans</span>
            <Badge>{snapshot.draftPlans.length}</Badge>
          </div>
        </div>
      </section>
    </>
  );
}

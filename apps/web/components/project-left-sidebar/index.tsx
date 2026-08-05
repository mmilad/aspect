"use client";

import Link from "next/link";
import { CircleDot, FileText, GitFork, ListTodo, Network, Tags } from "lucide-react";
import type { EntityType, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../badge";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

interface ProjectLeftSidebarProps {
  snapshot: ProjectPlanSnapshot;
  activeView: "workspace" | "graph" | "entity";
  activeTypes?: Set<EntityType>;
  entityTypes?: EntityType[];
  centerNode?: ProjectNode;
  recentScopes?: ProjectNode[];
  onSelectTypes?: (types: Set<EntityType>) => void;
  onToggleType?: (type: EntityType) => void;
  onOpenScope?: (id: string) => void;
}

const workTypes: EntityType[] = ["aspect", "feature", "task"];

export function ProjectLeftSidebar({
  snapshot,
  activeView,
  activeTypes,
  entityTypes = [],
  centerNode,
  recentScopes = [],
  onSelectTypes,
  onToggleType,
  onOpenScope
}: ProjectLeftSidebarProps) {
  const projectHref = `/projects/${snapshot.project.key}`;
  const graphHref = `/projects/${snapshot.project.key}/graph`;

  return (
    <div className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.heading}>Views</div>
        <nav className={styles.nav} aria-label="Project views">
          <Link className={cn(styles.link, activeView === "workspace" && styles.activeLink)} href={projectHref}>
            <span className="inline-flex items-center gap-2">
              <Network className="h-4 w-4" />
              Workspace
            </span>
          </Link>
          <Link className={cn(styles.link, activeView === "graph" && styles.activeLink)} href={graphHref}>
            <span className="inline-flex items-center gap-2">
              <GitFork className="h-4 w-4" />
              Graph
            </span>
          </Link>
          <div className={styles.link}>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <ListTodo className="h-4 w-4" />
              Tasks
            </span>
            <Badge>{snapshot.tasks.length}</Badge>
          </div>
          <div className={styles.link}>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              Features
            </span>
            <Badge>{snapshot.features.length}</Badge>
          </div>
        </nav>
      </section>

      {activeTypes && onSelectTypes && onToggleType ? (
        <section className={styles.section}>
          <div className={styles.heading}>Graph Filters</div>
          <div className={styles.filterGrid}>
            <button className="h-7 rounded-md border border-border bg-white px-2 text-xs hover:bg-muted" onClick={() => onSelectTypes(new Set(entityTypes))}>
              All
            </button>
            <button className="h-7 rounded-md border border-border bg-white px-2 text-xs hover:bg-muted" onClick={() => onSelectTypes(new Set(workTypes))}>
              Work
            </button>
            {entityTypes.map((type) => {
              const active = activeTypes.has(type);
              return (
                <button
                  key={type}
                  className={cn(
                    "h-7 rounded-md border px-2 text-xs capitalize",
                    active ? "border-teal-700 bg-teal-50 text-teal-900" : "border-border bg-white text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => onToggleType(type)}
                >
                  {type.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.heading}>Scope</div>
        {centerNode ? (
          <button className={styles.scopeItem} title={centerNode.path} onClick={() => onOpenScope?.(centerNode.id)}>
            <span className="inline-flex min-w-0 items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 shrink-0 text-teal-700" />
              <span className="truncate">{centerNode.title}</span>
            </span>
          </button>
        ) : null}
        <div className="mt-2 grid gap-1">
          {recentScopes.slice(0, 5).map((scope) => (
            <button key={scope.id} className={styles.scopeItem} title={scope.path} onClick={() => onOpenScope?.(scope.id)}>
              {scope.title}
            </button>
          ))}
        </div>
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
    </div>
  );
}

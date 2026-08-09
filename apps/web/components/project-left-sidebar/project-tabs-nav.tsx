"use client";

import Link from "next/link";
import { Columns3, GitFork, ListTodo } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { projectPaths } from "../../lib/project-paths";
import { isGraphNavActive, type ProjectView } from "../../lib/project-view";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

interface ProjectTabsNavProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  /** Carry-over for `?selected=` when switching tabs / returning to graph. */
  selectedId?: string;
}

export function ProjectTabsNav({ snapshot, activeView, selectedId }: ProjectTabsNavProps) {
  const key = snapshot.project.key;

  return (
    <section className={styles.section}>
      <div className={styles.heading}>Project Tabs</div>
      <nav className={styles.nav} aria-label="Project tabs">
        <Link
          className={cn(styles.link, isGraphNavActive(activeView) && styles.activeLink)}
          href={projectPaths.graph(key, selectedId)}
        >
          <span className="inline-flex items-center gap-2">
            <GitFork className="h-4 w-4" />
            Graph
          </span>
        </Link>
        <Link
          className={cn(styles.link, activeView === "issues" && styles.activeLink)}
          href={projectPaths.issues(key, selectedId)}
        >
          <span className="inline-flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Issues
          </span>
        </Link>
        <Link
          className={cn(styles.link, activeView === "kanban" && styles.activeLink)}
          href={projectPaths.kanban(key, selectedId)}
        >
          <span className="inline-flex items-center gap-2">
            <Columns3 className="h-4 w-4" />
            Kanban
          </span>
        </Link>
      </nav>
    </section>
  );
}

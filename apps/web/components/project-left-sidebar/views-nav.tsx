"use client";

import Link from "next/link";
import { GitFork, Network, Workflow } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { projectPaths } from "../../lib/project-paths";
import { isWorkflowsNavActive, type ProjectView } from "../../lib/project-view";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

interface ViewsNavProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
}

export function ViewsNav({ snapshot, activeView }: ViewsNavProps) {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>Views</div>
      <nav className={styles.nav} aria-label="Project views">
        <Link
          className={cn(styles.link, activeView === "workspace" && styles.activeLink)}
          href={projectPaths.workspace(snapshot.project.key)}
        >
          <span className="inline-flex items-center gap-2">
            <Network className="h-4 w-4" />
            Workspace
          </span>
        </Link>
        <Link
          className={cn(styles.link, activeView === "graph" && styles.activeLink)}
          href={projectPaths.graph(snapshot.project.key)}
        >
          <span className="inline-flex items-center gap-2">
            <GitFork className="h-4 w-4" />
            Graph
          </span>
        </Link>
        <Link
          className={cn(styles.link, isWorkflowsNavActive(activeView) && styles.activeLink)}
          href={projectPaths.workflows(snapshot.project.key)}
        >
          <span className="inline-flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </span>
        </Link>
      </nav>
    </section>
  );
}

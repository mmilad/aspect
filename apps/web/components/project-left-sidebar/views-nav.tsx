"use client";

import Link from "next/link";
import { FileText, GitFork, ListTodo, Network } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../ui/badge";
import { projectPaths } from "../../lib/project-paths";
import type { ProjectView } from "../../lib/project-view";
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
  );
}

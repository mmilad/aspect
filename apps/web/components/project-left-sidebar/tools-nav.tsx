"use client";

import Link from "next/link";
import { Braces, Workflow } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { projectPaths } from "../../lib/project-paths";
import { isSchemasNavActive, isWorkflowsNavActive, type ProjectView } from "../../lib/project-view";
import { cn } from "../../lib/utils";
import styles from "./style.module.css";

interface ToolsNavProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
}

export function ToolsNav({ snapshot, activeView }: ToolsNavProps) {
  const key = snapshot.project.key;

  return (
    <section className={styles.section}>
      <div className={styles.heading}>Tools</div>
      <nav className={styles.nav} aria-label="Project tools">
        <Link
          className={cn(styles.link, isWorkflowsNavActive(activeView) && styles.activeLink)}
          href={projectPaths.workflows(key)}
        >
          <span className="inline-flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </span>
        </Link>
        <Link
          className={cn(styles.link, isSchemasNavActive(activeView) && styles.activeLink)}
          href={projectPaths.schemas(key)}
        >
          <span className="inline-flex items-center gap-2">
            <Braces className="h-4 w-4" />
            Schemas
          </span>
        </Link>
      </nav>
    </section>
  );
}

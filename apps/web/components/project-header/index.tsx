import Link from "next/link";
import { Workflow } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../badge";
import styles from "./style.module.css";

interface ProjectHeaderProps {
  project: ProjectPlanSnapshot["project"];
  scopeLabel?: string;
  activeView: "workspace" | "graph" | "entity";
}

const viewLabel: Record<ProjectHeaderProps["activeView"], string> = {
  workspace: "Workspace",
  graph: "Graph",
  entity: "Entity Detail"
};

export function ProjectHeader({ project, scopeLabel, activeView }: ProjectHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.mark}>
          <Workflow className="h-4 w-4" />
        </div>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{project.title}</div>
          <div className={styles.scope}>
            {viewLabel[activeView]}
            {scopeLabel ? ` / ${scopeLabel}` : ""}
          </div>
        </div>
      </div>
      <nav className={styles.actions} aria-label="Project actions">
        <Badge>{project.key}</Badge>
        <Link className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={`/projects/${project.key}`}>
          Workspace
        </Link>
        <Link className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" href={`/projects/${project.key}/graph`}>
          Graph
        </Link>
      </nav>
    </header>
  );
}

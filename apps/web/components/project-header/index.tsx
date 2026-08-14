import Link from "next/link";
import { Workflow } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../ui/badge";
import { projectViewLabel, type ProjectView } from "../../lib/project-view";
import styles from "./style.module.css";

export type HeaderChromeContext = {
  /** Selected / detail entity id (entity graph surface). */
  entityId?: string;
  /** Active flow id when editing a workflow. */
  flowId?: string;
};

interface ProjectHeaderProps {
  project: ProjectPlanSnapshot["project"];
  scopeLabel?: string;
  activeView: ProjectView;
  chrome?: HeaderChromeContext;
}

export function ProjectHeader({ project, scopeLabel, activeView }: ProjectHeaderProps) {
  const key = project.key;
  const crumbs = [project.title, projectViewLabel[activeView], scopeLabel].filter(Boolean);

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <div className={styles.identity}>
          <Link href="/" className={styles.mark} aria-label="Projects overview">
            <Workflow className="h-4 w-4" />
          </Link>
          <div className={styles.titleBlock}>
            <div className={styles.title}>{project.title}</div>
            <div className={styles.scope}>{key}</div>
          </div>
        </div>
        <div className={styles.topActions}>
          <Link
            href="/"
            className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-muted"
          >
            Projects
          </Link>
          <Badge>{key}</Badge>
        </div>
      </div>

      <nav className={styles.subnav} aria-label="Breadcrumb">
        <ol className={styles.breadcrumb}>
          {crumbs.map((crumb, index) => (
            <li key={`${crumb}-${index}`} className={styles.breadcrumbItem}>
              {crumb}
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}

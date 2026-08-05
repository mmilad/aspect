import type { ReactNode } from "react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { ProjectHeader } from "../project-header";
import styles from "./style.module.css";

interface ProjectShellProps {
  project: ProjectPlanSnapshot["project"];
  scopeLabel?: string;
  activeView: "workspace" | "graph" | "entity";
  leftSidebar: ReactNode;
  center: ReactNode;
  rightSidebar: ReactNode;
}

export function ProjectShell({ project, scopeLabel, activeView, leftSidebar, center, rightSidebar }: ProjectShellProps) {
  return (
    <main className={styles.shell}>
      <ProjectHeader project={project} scopeLabel={scopeLabel} activeView={activeView} />
      <div className={styles.body}>
        <aside className={styles.left}>{leftSidebar}</aside>
        <section className={styles.center}>{center}</section>
        <aside className={styles.right}>{rightSidebar}</aside>
      </div>
    </main>
  );
}

import type { ReactNode } from "react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import type { ProjectView } from "../../lib/project-view";
import { ProjectHeader, type HeaderChromeContext } from "../project-header";
import { ShellBody } from "./shell-body";
import styles from "./style.module.css";

interface ProjectShellProps {
  project: ProjectPlanSnapshot["project"];
  scopeLabel?: string;
  activeView: ProjectView;
  chrome?: HeaderChromeContext;
  leftSidebar: ReactNode;
  center: ReactNode;
  rightSidebar: ReactNode;
}

export function ProjectShell({
  project,
  scopeLabel,
  activeView,
  chrome,
  leftSidebar,
  center,
  rightSidebar
}: ProjectShellProps) {
  return (
    <main className={styles.shell}>
      <ProjectHeader project={project} scopeLabel={scopeLabel} activeView={activeView} chrome={chrome} />
      <ShellBody projectKey={project.key} leftSidebar={leftSidebar} center={center} rightSidebar={rightSidebar} />
    </main>
  );
}

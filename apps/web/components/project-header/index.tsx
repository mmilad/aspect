import { Workflow } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../ui/badge";
import { ToolbarLink } from "../ui/ghost-button";
import { projectPaths } from "../../lib/project-paths";
import { isWorkflowsNavActive, projectViewLabel, type ProjectView } from "../../lib/project-view";
import styles from "./style.module.css";

interface ProjectHeaderProps {
  project: ProjectPlanSnapshot["project"];
  scopeLabel?: string;
  activeView: ProjectView;
}

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
            {projectViewLabel[activeView]}
            {scopeLabel ? ` / ${scopeLabel}` : ""}
          </div>
        </div>
      </div>
      <nav className={styles.actions} aria-label="Project actions">
        <Badge>{project.key}</Badge>
        <ToolbarLink href={projectPaths.workspace(project.key)} active={activeView === "workspace"}>
          Workspace
        </ToolbarLink>
        <ToolbarLink href={projectPaths.graph(project.key)} active={activeView === "graph"}>
          Graph
        </ToolbarLink>
        <ToolbarLink href={projectPaths.workflows(project.key)} active={isWorkflowsNavActive(activeView)}>
          Workflows
        </ToolbarLink>
      </nav>
    </header>
  );
}

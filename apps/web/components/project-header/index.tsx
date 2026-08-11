import Link from "next/link";
import { Workflow } from "lucide-react";
import type { ProjectPlanSnapshot } from "@projectplaner/core";
import { Badge } from "../ui/badge";
import { ToolbarLink } from "../ui/ghost-button";
import { projectPaths } from "../../lib/project-paths";
import {
  chromeSurfaceForView,
  chromeSurfaceLabel,
  projectViewLabel,
  type ProjectView
} from "../../lib/project-view";
import { cn } from "../../lib/utils";
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

export function ProjectHeader({ project, scopeLabel, activeView, chrome }: ProjectHeaderProps) {
  const surface = chromeSurfaceForView(activeView);
  const key = project.key;

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <div className={styles.identity}>
          <div className={styles.mark}>
            <Workflow className="h-4 w-4" />
          </div>
          <div className={styles.titleBlock}>
            <div className={styles.title}>{project.title}</div>
            <div className={styles.scope}>
              {chromeSurfaceLabel[surface]}
              {" / "}
              {projectViewLabel[activeView]}
              {scopeLabel ? ` / ${scopeLabel}` : ""}
            </div>
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
          <div className={styles.surfaceSwitch} role="tablist" aria-label="Chrome surface">
            <ToolbarLink
              href={projectPaths.workspace(key)}
              size="xs"
              active={surface === "entity-graph"}
              aria-current={surface === "entity-graph" ? "page" : undefined}
            >
              Entity Graph
            </ToolbarLink>
            <ToolbarLink
              href={projectPaths.workflows(key)}
              size="xs"
              tone="workflow"
              active={surface === "workflows"}
              aria-current={surface === "workflows" ? "page" : undefined}
            >
              Workflows
            </ToolbarLink>
          </div>
        </div>
      </div>

      <nav className={styles.subnav} aria-label="Header subnav">
        {surface === "entity-graph" ? (
          <>
            <span className={styles.subnavLabel}>Graph chrome</span>
            <ToolbarLink href={projectPaths.workspace(key)} size="xs" active={activeView === "workspace"}>
              Workspace
            </ToolbarLink>
            <ToolbarLink href={projectPaths.graph(key)} size="xs" active={activeView === "graph"}>
              Graph
            </ToolbarLink>
          </>
        ) : (
          <>
            <span className={cn(styles.subnavLabel, styles.subnavLabelWorkflow)}>Workflow chrome</span>
            <ToolbarLink
              href={projectPaths.workflows(key)}
              size="xs"
              tone="workflow"
              active={activeView === "workflows"}
            >
              List
            </ToolbarLink>
            {chrome?.flowId ? (
              <>
                <ToolbarLink
                  href={projectPaths.flow(key, chrome.flowId)}
                  size="xs"
                  tone="workflow"
                  active={activeView === "workflow"}
                >
                  Editor
                </ToolbarLink>
                <span className={styles.subnavDivider} aria-hidden />
                <ToolbarLink href={projectPaths.entity(key, chrome.flowId)} size="xs">
                  Entity
                </ToolbarLink>
                <ToolbarLink href={projectPaths.graph(key, chrome.flowId)} size="xs">
                  Graph
                </ToolbarLink>
              </>
            ) : null}
          </>
        )}
      </nav>
    </header>
  );
}

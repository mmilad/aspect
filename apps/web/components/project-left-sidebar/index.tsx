"use client";

import type { EntityType, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { ProjectView } from "../../lib/project-view";
import styles from "./style.module.css";
import { ViewsNav } from "./views-nav";
import { WorkflowsSection } from "./workflows-section";
import { GraphFilters } from "./graph-filters";
import { ScopeSection } from "./scope-section";

interface ProjectLeftSidebarProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  activeTypes?: Set<EntityType>;
  entityTypes?: EntityType[];
  centerNode?: ProjectNode;
  recentScopes?: ProjectNode[];
  onSelectTypes?: (types: Set<EntityType>) => void;
  onToggleType?: (type: EntityType) => void;
  onOpenScope?: (id: string) => void;
}

export function ProjectLeftSidebar({
  snapshot,
  activeView,
  activeTypes,
  entityTypes = [],
  centerNode,
  recentScopes = [],
  onSelectTypes,
  onToggleType,
  onOpenScope
}: ProjectLeftSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <ViewsNav snapshot={snapshot} activeView={activeView} />
      <WorkflowsSection snapshot={snapshot} activeView={activeView} centerNode={centerNode} />
      {activeTypes && onSelectTypes && onToggleType ? (
        <GraphFilters
          activeTypes={activeTypes}
          entityTypes={entityTypes}
          onSelectTypes={onSelectTypes}
          onToggleType={onToggleType}
        />
      ) : null}
      <ScopeSection snapshot={snapshot} centerNode={centerNode} recentScopes={recentScopes} onOpenScope={onOpenScope} />
    </div>
  );
}

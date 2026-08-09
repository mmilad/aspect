"use client";

import type { EntityType, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { ProjectView } from "../../lib/project-view";
import { isGraphNavActive } from "../../lib/project-view";
import styles from "./style.module.css";
import { ProjectTabsNav } from "./project-tabs-nav";
import { GraphFilters } from "./graph-filters";
import { ScopeSection } from "./scope-section";
import { CreationRail } from "./creation-rail";

interface ProjectLeftSidebarProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  selectedId?: string;
  activeTypes?: Set<EntityType>;
  entityTypes?: EntityType[];
  centerNode?: ProjectNode;
  recentScopes?: ProjectNode[];
  onSelectTypes?: (types: Set<EntityType>) => void;
  onToggleType?: (type: EntityType) => void;
  onOpenScope?: (id: string) => void;
  onCreated?: (id: string) => void;
}

export function ProjectLeftSidebar({
  snapshot,
  activeView,
  selectedId,
  activeTypes,
  entityTypes = [],
  centerNode,
  recentScopes = [],
  onSelectTypes,
  onToggleType,
  onOpenScope,
  onCreated
}: ProjectLeftSidebarProps) {
  const graphActive = isGraphNavActive(activeView);
  const resolvedSelectedId = selectedId ?? centerNode?.id;

  return (
    <div className={styles.sidebar}>
      <ProjectTabsNav snapshot={snapshot} activeView={activeView} selectedId={resolvedSelectedId} />
      <CreationRail
        snapshot={snapshot}
        selectedId={resolvedSelectedId}
        centerNode={centerNode}
        onCreated={onCreated}
      />
      {graphActive && activeTypes && onSelectTypes && onToggleType ? (
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

import type { EntityType, ProjectPlanSnapshot } from "@projectplaner/core";
import type { ProjectView } from "../../lib/project-view";
import { isGraphNavActive } from "../../lib/project-view";
import styles from "./style.module.css";
import { ProjectTabsNav } from "./project-tabs-nav";
import { ToolsNav } from "./tools-nav";
import { GraphFilters } from "./graph-filters";
import { AssistantSessionsSection } from "./assistant-sessions-section";
import { AgentsSection } from "./agents-section";

interface ProjectLeftSidebarProps {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  selectedId?: string;
  activeTypes?: Set<EntityType>;
  entityTypes?: EntityType[];
  onSelectTypes?: (types: Set<EntityType>) => void;
  onToggleType?: (type: EntityType) => void;
}

export function ProjectLeftSidebar({
  snapshot,
  activeView,
  selectedId,
  activeTypes,
  entityTypes = [],
  onSelectTypes,
  onToggleType
}: ProjectLeftSidebarProps) {
  const graphActive = isGraphNavActive(activeView);

  return (
    <div className={styles.sidebar}>
      <ProjectTabsNav snapshot={snapshot} activeView={activeView} selectedId={selectedId} />
      <AgentsSection snapshot={snapshot} />
      <AssistantSessionsSection />
      <ToolsNav snapshot={snapshot} activeView={activeView} />
      {graphActive && activeTypes && onSelectTypes && onToggleType ? (
        <GraphFilters
          activeTypes={activeTypes}
          entityTypes={entityTypes}
          onSelectTypes={onSelectTypes}
          onToggleType={onToggleType}
        />
      ) : null}
    </div>
  );
}

import type { ReactNode } from "react";
import type { Feature, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { EntityPreview } from "../../lib/entity-preview";
import type { ProjectView } from "../../lib/project-view";
import type { HeaderChromeContext } from "../project-header";
import { ProjectLeftSidebar } from "../project-left-sidebar";
import { ProjectShell } from "../project-shell";
import { SelectionInspector } from "../selection-inspector";
import { WorkspaceCenter } from "../workspace-center";

export type ProjectViewShellProps = {
  snapshot: ProjectPlanSnapshot;
  activeView: ProjectView;
  scopeLabel?: string;
  chrome?: HeaderChromeContext;
  center: ReactNode;
  /** When true, center pane scrolls (entity detail). Default fill/overflow hidden. */
  scrollCenter?: boolean;
  /** Carry-over for sidebar Project Tabs (`?selected=` → Graph). */
  selectedId?: string;
  selectedNode?: ProjectNode | null;
  selectedFeature?: Feature | null;
  entity?: EntityPreview;
  tags?: ProjectPlanSnapshot["tags"];
  incomingCount?: number;
  outgoingCount?: number;
  relatedFeatures?: Feature[];
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
};

/**
 * Shared 3-pane project page wiring for entity/flow (and similar) views.
 * Graph/workspace keep their own host because they own interactive selection state.
 */
export function ProjectViewShell({
  snapshot,
  activeView,
  scopeLabel,
  chrome,
  center,
  scrollCenter = false,
  selectedId,
  selectedNode = null,
  selectedFeature = null,
  entity,
  tags = [],
  incomingCount = 0,
  outgoingCount = 0,
  relatedFeatures,
  leftSidebar,
  rightSidebar
}: ProjectViewShellProps) {
  const rootNode = snapshot.nodes[0];
  const node = selectedNode ?? rootNode;
  const previewEntity = entity ?? {
    id: node.id,
    type: node.type,
    key: null,
    title: node.title,
    summary: node.summary,
    body: node.body,
    status: node.status,
    path: node.path
  };

  const resolvedChrome: HeaderChromeContext = {
    entityId:
      chrome?.entityId ??
      selectedId ??
      (activeView === "entity" ? entity?.id ?? node?.id : undefined),
    flowId: chrome?.flowId ?? (activeView === "workflow" ? entity?.id ?? node?.id : undefined)
  };

  return (
    <ProjectShell
      project={snapshot.project}
      scopeLabel={scopeLabel}
      activeView={activeView}
      chrome={resolvedChrome}
      leftSidebar={
        leftSidebar ?? (
          <ProjectLeftSidebar
            snapshot={snapshot}
            activeView={activeView}
            selectedId={selectedId ?? node?.id}
            centerNode={node}
            recentScopes={node ? [node] : []}
          />
        )
      }
      center={<WorkspaceCenter scroll={scrollCenter}>{center}</WorkspaceCenter>}
      rightSidebar={
        rightSidebar ?? (
          <SelectionInspector
            projectKey={snapshot.project.key}
            center={node}
            node={node}
            entity={previewEntity}
            feature={selectedFeature}
            tags={tags}
            snapshot={snapshot}
            relatedFeatures={relatedFeatures}
            incomingCount={incomingCount}
            outgoingCount={outgoingCount}
          />
        )
      }
    />
  );
}

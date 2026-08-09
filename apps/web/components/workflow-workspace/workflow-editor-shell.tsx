"use client";

import type { Feature, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { Entity } from "@projectplaner/core";
import type { EntityPreview } from "../../lib/entity-preview";
import { ProjectViewShell } from "../project-view-shell";
import {
  EntityInspector,
  InspectorHost,
  WorkflowStepInspector
} from "../inspector";
import { WorkflowWorkspace } from "./index";
import { WorkflowInspectorProvider, useWorkflowInspectorSession } from "./workflow-inspector-context";

export type WorkflowEditorShellProps = {
  snapshot: ProjectPlanSnapshot;
  flow: Entity;
  selectedNode: ProjectNode | null;
  selectedFeature: Feature | null;
  tags?: ProjectPlanSnapshot["tags"];
  incomingCount?: number;
  outgoingCount?: number;
  relatedFeatures?: Feature[];
};

function WorkflowRightSidebar({
  snapshot,
  flow,
  selectedNode,
  selectedFeature,
  tags,
  incomingCount,
  outgoingCount,
  relatedFeatures
}: Omit<WorkflowEditorShellProps, "flow"> & { flow: EntityPreview }) {
  const session = useWorkflowInspectorSession();
  const node = selectedNode ?? snapshot.nodes[0];
  const showStep = Boolean(session && !session.diagramOpen && session.selected);

  if (showStep && session) {
    return (
      <InspectorHost eyebrow="Step">
        <WorkflowStepInspector
          selected={session.selected}
          bagView={session.bagView}
          onUpdateData={session.onUpdateData}
          onUpdateType={session.onUpdateType}
          onDelete={session.onDelete}
        />
      </InspectorHost>
    );
  }

  return (
    <InspectorHost>
      <EntityInspector
        projectKey={snapshot.project.key}
        center={node}
        node={node}
        entity={flow}
        feature={selectedFeature}
        tags={tags}
        snapshot={snapshot}
        relatedFeatures={relatedFeatures}
        incomingCount={incomingCount}
        outgoingCount={outgoingCount}
      />
    </InspectorHost>
  );
}

/**
 * Client host for flow editor: project shell + center workspace + shell right inspector.
 */
export function WorkflowEditorShell({
  snapshot,
  flow,
  selectedNode,
  selectedFeature,
  tags = [],
  incomingCount = 0,
  outgoingCount = 0,
  relatedFeatures
}: WorkflowEditorShellProps) {
  return (
    <WorkflowInspectorProvider>
      <ProjectViewShell
        snapshot={snapshot}
        activeView="workflow"
        scopeLabel={`workflow / ${flow.title}`}
        selectedNode={selectedNode}
        selectedFeature={selectedFeature}
        entity={flow}
        tags={tags}
        incomingCount={incomingCount}
        outgoingCount={outgoingCount}
        relatedFeatures={relatedFeatures}
        center={<WorkflowWorkspace projectKey={snapshot.project.key} flow={flow} />}
        rightSidebar={
          <WorkflowRightSidebar
            snapshot={snapshot}
            flow={flow}
            selectedNode={selectedNode}
            selectedFeature={selectedFeature}
            tags={tags}
            incomingCount={incomingCount}
            outgoingCount={outgoingCount}
            relatedFeatures={relatedFeatures}
          />
        }
      />
    </WorkflowInspectorProvider>
  );
}

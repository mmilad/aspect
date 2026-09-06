"use client";

import type { Feature, ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import type { Entity } from "@projectplaner/core";
import type { EntityPreview } from "../../lib/entity-preview";
import { ProjectViewShell } from "../project-view-shell";
import {
  EntityInspector,
  InspectorHost,
  WorkflowAuthorInspector,
  WorkflowStepInspector
} from "../inspector";
import { WorkflowVariablesPanel } from "../inspector/workflow-step-inspector/variables";
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

  if (session?.authorOpen) {
    return (
      <InspectorHost eyebrow="Author">
        <WorkflowAuthorInspector
          brief={session.brief}
          generating={session.generating}
          onBriefChange={session.onBriefChange}
          onGenerate={session.onGenerate}
        />
      </InspectorHost>
    );
  }

  const showStep = Boolean(session && session.selected);
  if (showStep && session) {
    const showWorkflowVariables = session.selected?.type === "start" || session.selected?.type === "end";
    return (
      <InspectorHost eyebrow="Step">
        <div className="space-y-3">
          {showWorkflowVariables ? (
            <div className="border-b border-border p-3">
              <WorkflowVariablesPanel variables={session.variables} onChange={session.onUpdateVariables} />
            </div>
          ) : null}
          <WorkflowStepInspector
            selected={session.selected}
            bagView={session.bagView}
            pinMode={session.pinMode}
            projectKey={snapshot.project.key}
            onUpdateData={session.onUpdateData}
            onRenameDataPort={session.onRenameDataPort}
            onRemoveDataPort={session.onRemoveDataPort}
            onDelete={session.onDelete}
          />
        </div>
      </InspectorHost>
    );
  }

  return (
    <InspectorHost>
      <div className="space-y-3">
        {session ? (
          <div className="border-b border-border p-3">
            <WorkflowVariablesPanel variables={session.variables} onChange={session.onUpdateVariables} />
          </div>
        ) : null}
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
      </div>
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

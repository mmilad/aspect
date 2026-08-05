import { notFound } from "next/navigation";
import { WorkflowWorkspace } from "../../../../../components/workflow-workspace";
import { ProjectLeftSidebar } from "../../../../../components/project-left-sidebar";
import { ProjectShell } from "../../../../../components/project-shell";
import { SelectionInspector } from "../../../../../components/selection-inspector";
import { WorkspaceCenter } from "../../../../../components/workspace-center";
import { loadEntityDetail, loadProject } from "../../../../../lib/data";

export default async function FlowWorkflowPage({
  params
}: {
  params: Promise<{ projectKey: string; flowId: string }>;
}) {
  const { projectKey, flowId } = await params;
  const detail = await loadEntityDetail(projectKey, flowId);
  const snapshot = await loadProject(projectKey);

  if (!detail || !snapshot || detail.entity.type !== "flow") {
    notFound();
  }

  const { project, entity } = detail;
  const rootNode = snapshot.nodes[0];
  const selectedNode = snapshot.nodes.find((node) => node.id === entity.id) ?? rootNode;
  const selectedFeature = snapshot.features.find((feature) => feature.id === entity.id) ?? null;

  return (
    <ProjectShell
      project={project}
      scopeLabel={`workflow / ${entity.title}`}
      activeView="workflow"
      leftSidebar={
        <ProjectLeftSidebar
          snapshot={snapshot}
          activeView="workflow"
          centerNode={selectedNode}
          recentScopes={selectedNode ? [selectedNode] : []}
        />
      }
      center={
        <WorkspaceCenter>
          <WorkflowWorkspace projectKey={project.key} flow={entity} />
        </WorkspaceCenter>
      }
      rightSidebar={
        <SelectionInspector
          projectKey={project.key}
          center={selectedNode ?? rootNode}
          node={selectedNode ?? rootNode}
          entity={entity}
          feature={selectedFeature}
          tags={detail.tags}
          incomingCount={detail.relations.filter((item) => item.direction === "incoming").length}
          outgoingCount={detail.relations.filter((item) => item.direction === "outgoing").length}
        />
      }
    />
  );
}

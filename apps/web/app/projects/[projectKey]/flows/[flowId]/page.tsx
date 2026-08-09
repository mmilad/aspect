import { notFound } from "next/navigation";
import { WorkflowEditorShell } from "../../../../../components/workflow-workspace/workflow-editor-shell";
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

  const { entity } = detail;
  const rootNode = snapshot.nodes[0];
  const selectedNode = snapshot.nodes.find((node) => node.id === entity.id) ?? rootNode;
  const selectedFeature = snapshot.features.find((feature) => feature.id === entity.id) ?? null;

  return (
    <WorkflowEditorShell
      snapshot={snapshot}
      flow={entity}
      selectedNode={selectedNode}
      selectedFeature={selectedFeature}
      tags={detail.tags}
      incomingCount={detail.relations.filter((item) => item.direction === "incoming").length}
      outgoingCount={detail.relations.filter((item) => item.direction === "outgoing").length}
    />
  );
}

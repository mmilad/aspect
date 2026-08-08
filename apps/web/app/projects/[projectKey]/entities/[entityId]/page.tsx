import { notFound } from "next/navigation";
import { ProjectViewShell } from "../../../../../components/project-view-shell";
import { EntityDetail, isDetailTab } from "../../../../../components/entity-detail";
import { formatEntityType } from "../../../../../lib/entity-label";
import { loadProject, loadEntityDetail } from "../../../../../lib/data";

export default async function EntityDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ projectKey: string; entityId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectKey, entityId } = await params;
  const query = await searchParams;
  const tab = isDetailTab(query.tab) ? query.tab : "overview";
  const detail = await loadEntityDetail(projectKey, entityId);
  const snapshot = await loadProject(projectKey);

  if (!detail || !snapshot) {
    notFound();
  }

  const { entity } = detail;
  const rootNode = snapshot.nodes[0];
  const selectedNode = snapshot.nodes.find((node) => node.id === entity.id) ?? rootNode;
  const selectedFeature = snapshot.features.find((feature) => feature.id === entity.id) ?? null;

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="entity"
      scopeLabel={`${formatEntityType(entity.type)}${entity.key ? ` / ${entity.key}` : ""} / ${entity.title}`}
      scrollCenter
      selectedNode={selectedNode}
      selectedFeature={selectedFeature}
      entity={entity}
      tags={detail.tags}
      incomingCount={detail.relations.filter((item) => item.direction === "incoming").length}
      outgoingCount={detail.relations.filter((item) => item.direction === "outgoing").length}
      center={<EntityDetail detail={detail} tab={tab} />}
    />
  );
}

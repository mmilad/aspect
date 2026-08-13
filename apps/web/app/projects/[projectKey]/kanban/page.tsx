import { notFound } from "next/navigation";
import { KanbanBoard } from "../../../../components/kanban-board";
import { ProjectViewShell } from "../../../../components/project-view-shell";
import { loadProject } from "../../../../lib/data";
import { buildKanbanSidebarScopes } from "../../../../lib/kanban";

export default async function ProjectKanbanPage({
  params,
  searchParams
}: {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ selected?: string; scope?: string }>;
}) {
  const { projectKey } = await params;
  const query = await searchParams;
  const snapshot = await loadProject(projectKey);

  if (!snapshot) {
    notFound();
  }

  const scopeId = query.scope ?? null;
  const { center: scopeCenter, recent: recentScopes, focusNode } = buildKanbanSidebarScopes(
    snapshot,
    scopeId
  );
  const scopeFeature = scopeId ? snapshot.features.find((feature) => feature.id === scopeId) : null;

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="kanban"
      scopeLabel={scopeCenter.title}
      selectedId={query.selected ?? scopeId ?? focusNode?.id}
      selectedNode={focusNode}
      selectedFeature={scopeFeature ?? null}
      scopeCenter={scopeCenter}
      recentScopes={recentScopes}
      scrollCenter
      center={
        <KanbanBoard snapshot={snapshot} scopeId={scopeId} selectedId={query.selected ?? scopeId ?? undefined} />
      }
    />
  );
}

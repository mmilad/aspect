import { notFound } from "next/navigation";
import { KanbanBoard } from "../../../../components/kanban-board";
import { ProjectViewShell } from "../../../../components/project-view-shell";
import { loadProject } from "../../../../lib/data";

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
  const scopeNode = scopeId ? snapshot.nodes.find((node) => node.id === scopeId) : null;
  const scopeFeature = scopeId ? snapshot.features.find((feature) => feature.id === scopeId) : null;
  const scopeLabel = scopeNode?.title ?? scopeFeature?.title ?? "kanban";

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="kanban"
      scopeLabel={scopeLabel}
      selectedId={query.selected ?? scopeId ?? undefined}
      scrollCenter
      center={
        <KanbanBoard snapshot={snapshot} scopeId={scopeId} selectedId={query.selected ?? scopeId ?? undefined} />
      }
    />
  );
}

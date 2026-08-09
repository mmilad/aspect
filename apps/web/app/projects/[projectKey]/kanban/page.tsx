import { notFound } from "next/navigation";
import { OperationalPane } from "../../../../components/operational-pane";
import { ProjectViewShell } from "../../../../components/project-view-shell";
import { loadProject } from "../../../../lib/data";

export default async function ProjectKanbanPage({
  params,
  searchParams
}: {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ selected?: string }>;
}) {
  const { projectKey } = await params;
  const query = await searchParams;
  const snapshot = await loadProject(projectKey);

  if (!snapshot) {
    notFound();
  }

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="kanban"
      scopeLabel="kanban"
      selectedId={query.selected}
      scrollCenter
      center={
        <OperationalPane
          title="Kanban"
          purpose="Operational kanban tab. Full board depth is out of scope for this shell; use Graph for planning navigation."
        />
      }
    />
  );
}

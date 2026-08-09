import { notFound } from "next/navigation";
import { ProjectViewShell } from "../../../../components/project-view-shell";
import { WorkflowsOverview } from "../../../../components/workflows-overview";
import { loadProject } from "../../../../lib/data";

export default async function ProjectWorkflowsPage({
  params
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  const snapshot = await loadProject(projectKey);

  if (!snapshot) {
    notFound();
  }

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="workflows"
      scopeLabel="list"
      center={<WorkflowsOverview snapshot={snapshot} />}
    />
  );
}

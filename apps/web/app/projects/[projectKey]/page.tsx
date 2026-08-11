import { notFound } from "next/navigation";
import { ProjectViewShell } from "../../../components/project-view-shell";
import { ProjectWorkspaceHub } from "../../../components/project-workspace";
import { loadProject, loadProjectStats } from "../../../lib/data";

export default async function ProjectWorkspacePage({
  params
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  const [snapshot, stats] = await Promise.all([loadProject(projectKey), loadProjectStats(projectKey)]);

  if (!snapshot || !stats) {
    notFound();
  }

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="workspace"
      scopeLabel="hub"
      scrollCenter
      center={<ProjectWorkspaceHub snapshot={snapshot} stats={stats} />}
    />
  );
}

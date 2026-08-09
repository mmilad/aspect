import { notFound } from "next/navigation";
import { IssuesList } from "../../../../components/issues-list";
import { ProjectViewShell } from "../../../../components/project-view-shell";
import { loadProject } from "../../../../lib/data";

export default async function ProjectIssuesPage({
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
      activeView="issues"
      scopeLabel="issues"
      selectedId={query.selected}
      scrollCenter
      center={<IssuesList snapshot={snapshot} />}
    />
  );
}

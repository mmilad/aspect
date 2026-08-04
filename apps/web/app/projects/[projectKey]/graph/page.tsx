import { notFound } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { loadProject } from "../../../../lib/data";

export default async function ProjectGraphPage({
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

  return <AppShell snapshot={snapshot} graphOnly initialSelectedId={query.selected} />;
}

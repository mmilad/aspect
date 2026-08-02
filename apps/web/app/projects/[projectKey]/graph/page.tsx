import { notFound } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { loadProject } from "../../../../lib/data";

export default async function ProjectGraphPage({ params }: { params: Promise<{ projectKey: string }> }) {
  const { projectKey } = await params;
  const snapshot = await loadProject(projectKey);

  if (!snapshot) {
    notFound();
  }

  return <AppShell snapshot={snapshot} graphOnly />;
}


import { notFound } from "next/navigation";
import { ProjectViewShell } from "../../../../components/project-view-shell";
import { BuilderShell } from "../../../../components/schema-builder";
import { loadLlmJsonSchemas, loadProject } from "../../../../lib/data";

export default async function ProjectSchemasPage({
  params
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  const [snapshot, schemas] = await Promise.all([loadProject(projectKey), loadLlmJsonSchemas(projectKey)]);

  if (!snapshot) {
    notFound();
  }

  return (
    <ProjectViewShell
      snapshot={snapshot}
      activeView="schemas"
      scopeLabel="builder"
      scrollCenter
      center={<BuilderShell snapshot={snapshot} schemas={schemas} />}
    />
  );
}

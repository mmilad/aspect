import { ProjectsHub } from "../components/projects-hub";
import { loadProjects } from "../lib/data";

// Project lifecycle changes must be visible on reload in production, too.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await loadProjects();
  return <ProjectsHub initialProjects={projects} />;
}

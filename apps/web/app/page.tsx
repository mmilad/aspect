import { ProjectsHub } from "../components/projects-hub";
import { loadProjects } from "../lib/data";

export default async function HomePage() {
  const projects = await loadProjects();
  return <ProjectsHub initialProjects={projects} />;
}

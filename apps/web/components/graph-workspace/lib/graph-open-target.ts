import { projectPaths } from "../../../lib/project-paths";

/** Destination for graph node open (double-click / open action) → entity detail. */
export function graphNodeOpenHref(projectKey: string, entityId: string): string {
  return projectPaths.entity(projectKey, entityId);
}

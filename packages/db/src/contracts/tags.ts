import type { ProjectPlanSnapshot } from "@projectplaner/core";
export interface Operations {
  list(projectId: string): Promise<ProjectPlanSnapshot["tags"]>;
}

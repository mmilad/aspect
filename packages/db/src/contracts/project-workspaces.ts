import type { ProjectWorkspace, WorkspaceFailure } from "@projectplaner/core";
export interface Operations {
  get(projectId: string): Promise<ProjectWorkspace | null>;
  reserve(workspace: ProjectWorkspace, retry: boolean): Promise<boolean>;
  finish(workspace: ProjectWorkspace, error: WorkspaceFailure | null): Promise<void>;
}

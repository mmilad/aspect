import type { ProjectSummary } from "@projectplaner/core";
export type { ProjectSummary } from "@projectplaner/core";
export type ProjectStatsBucket = {
  total: number;
  planning: number;
  inProgress: number;
  done: number;
  other: number;
};
export type ProjectStats = {
  project: {
    id: string;
    key: string;
    title: string;
    description: string;
  };
  byType: Record<string, ProjectStatsBucket>;
  workflowDefs: number;
};
export type CreateProjectInput = {
  key: string;
  title: string;
  description?: string;
};
export interface Operations {
  setArchived(key: string, archived: boolean): Promise<ProjectSummary>;
  list(options?: {
    includeArchived?: boolean;
  }): Promise<ProjectSummary[]>;
  create(input: CreateProjectInput): Promise<{
    project: ProjectSummary;
  }>;
  remove(key: string): Promise<{
    deleted: string;
  }>;
  stats(key: string): Promise<ProjectStats | null>;
}

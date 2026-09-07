export type WorkspaceStatus = "provisioning" | "ready" | "failed";

export type WorkspaceErrorCode =
  | "invalid_input" | "not_found" | "archived" | "conflict"
  | "git_missing" | "authentication" | "timeout" | "git_failed"
  | "inaccessible" | "unavailable" | "interrupted";

export type WorkspaceFailure = { code: WorkspaceErrorCode; message: string };

export type CreateWorkspaceInput =
  | { mode: "create" }
  | { mode: "import"; sourceUrl: string };

export type ProjectWorkspace = {
  id: string;
  projectId: string;
  repositoryPath: string;
  mode: "create" | "import";
  sourceUrl: string | null;
  status: WorkspaceStatus;
  attemptId: string;
  ownerPid: number;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  lastError: WorkspaceFailure | null;
};

export type WorkspaceGitState = {
  branch: string | null;
  head: string | null;
  dirty: boolean;
  origin: string | null;
};

export type WorkspaceView = {
  workspace: ProjectWorkspace | null;
  archivedAt: string | null;
  git: WorkspaceGitState | null;
  error: WorkspaceFailure | null;
};

export type ProjectSummary = {
  id: string;
  key: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  entityCount: number;
  workflowCount: number;
  workspace: Pick<ProjectWorkspace, "id" | "status"> | null;
};

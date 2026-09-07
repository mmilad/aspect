import type { DatabaseSync } from "node:sqlite";
import type { ProjectWorkspace, WorkspaceFailure } from "@projectplaner/core";

function get(db: DatabaseSync, projectId: string): ProjectWorkspace | null {
  const row = db.prepare(`SELECT id, project_id AS projectId, repository_path AS repositoryPath,
    mode, source_url AS sourceUrl, status, attempt_id AS attemptId, owner_pid AS ownerPid,
    deadline_at AS deadlineAt, created_at AS createdAt, updated_at AS updatedAt, error_json AS errorJson
    FROM project_workspaces WHERE project_id = ?`).get(projectId) as (Omit<ProjectWorkspace, "lastError"> & { errorJson: string | null }) | undefined;
  if (!row) return null;
  const { errorJson, ...rest } = row;
  return { ...rest, lastError: errorJson ? JSON.parse(errorJson) as WorkspaceFailure : null };
}

/** Single SQL statement reserves ownership without keeping a transaction across Git. */
function reserve(db: DatabaseSync, workspace: ProjectWorkspace, retry: boolean): boolean {
  if (retry) {
    return db.prepare(`UPDATE project_workspaces SET status = 'provisioning', attempt_id = ?, owner_pid = ?,
      deadline_at = ?, updated_at = ?, error_json = NULL WHERE project_id = ? AND status = 'failed'
      AND EXISTS (SELECT 1 FROM projects WHERE id = project_id AND archived_at IS NULL)`)
      .run(workspace.attemptId, workspace.ownerPid, workspace.deadlineAt, workspace.updatedAt, workspace.projectId).changes === 1;
  }
  return db.prepare(`INSERT OR IGNORE INTO project_workspaces
    (id, project_id, repository_path, mode, source_url, status, attempt_id, owner_pid, deadline_at, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, 'provisioning', ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND archived_at IS NULL)`)
    .run(workspace.id, workspace.projectId, workspace.repositoryPath, workspace.mode, workspace.sourceUrl,
      workspace.attemptId, workspace.ownerPid, workspace.deadlineAt, workspace.createdAt, workspace.updatedAt, workspace.projectId).changes === 1;
}

function finish(db: DatabaseSync, workspace: ProjectWorkspace, error: WorkspaceFailure | null): void {
  db.prepare(`UPDATE project_workspaces SET status = ?, error_json = ?, updated_at = ?
    WHERE id = ? AND attempt_id = ? AND status = 'provisioning'`)
    .run(error ? "failed" : "ready", error ? JSON.stringify(error) : null, new Date().toISOString(), workspace.id, workspace.attemptId);
}

export default { get, reserve, finish };

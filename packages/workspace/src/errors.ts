import type { WorkspaceErrorCode, WorkspaceFailure } from "@projectplaner/core";

export class WorkspaceError extends Error {
  constructor(public readonly code: WorkspaceErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function workspaceFailure(error: unknown): WorkspaceFailure {
  return error instanceof WorkspaceError
    ? { code: error.code, message: error.message }
    : { code: "inaccessible", message: "The workspace directory could not be accessed. Check its location and permissions." };
}

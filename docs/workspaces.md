# Managed code workspaces

A Project can remain planning-only. Its overview offers an optional **Code workspace**:
create an empty Git repository on `main` (no generated files or initial commit), or
import an HTTPS/SSH repository. Imports retain normal history and the remote default
branch. They do not initialize submodules, install dependencies or run project commands.

Git must be installed on the Projectplaner host. Configure HTTPS credential helpers or
SSH keys and known hosts there before importing, including private repositories.
Interactive credential prompts are disabled. Embedded passwords/tokens, URL query
parameters, local paths and non-HTTPS/SSH transports are rejected. Errors and displayed
origins do not expose credentials. A failed import can be retried after fixing local
authentication or connectivity.

## Storage and backup

The default root is `%LOCALAPPDATA%/Projectplaner/workspaces` on Windows,
`~/Library/Application Support/Projectplaner/workspaces` on macOS, and
`${XDG_DATA_HOME:-~/.local/share}/Projectplaner/workspaces` on Linux. An absolute
`PROJECTPLANER_WORKSPACES_ROOT` overrides the root for new workspaces. Choose durable
user-data storage outside the app checkout, temporary folders and caches.

Each repository lives at `<root>/<immutable-workspace-id>/repo`. Changing the Project
title does not move it. Existing stored absolute paths remain authoritative when the
root setting changes. **Copy path** and **Open folder** expose this location; opening a
folder happens on the machine running the app. Missing or invalid repositories are
shown as unavailable and never silently recreated.

Back up both the SQLite database and the workspace root. Git alone does not preserve
uncommitted files or planning data. The app does not commit, push or publish code.
Changing machines requires restoring both data sets and preserving stored paths.

## Lifecycle

Setup reserves a unique Project association before running Git. Git runs with argument
arrays, a five-minute timeout and no open DB transaction. Each attempt uses an exclusive
staging directory and validates its repository before finalizing. Existing destinations
are never overwritten. Ownership records allow the next workspace read to recover a
finalized repository after an interrupted database update; other interrupted attempts
become failed and offer retry. A retry has a new attempt ID and staging directory.
Ordinary failures clean only that attempt's directory. A process crash can leave a
staging directory for later manual cleanup; it is never reused or treated as the repo.

Provisioning is an awaited server operation in this pass, not a durable worker job.
The panel shows progress while awaiting it; reopening the overview checks stored state.

Workspace-backed Projects use **Archive** instead of Delete. Archive preserves code,
planning entities, workflows and the workspace association. Archived keys remain
reserved. Use **Include archived projects** in the hub and **Restore** to reactivate.
Direct Project URLs remain accessible. Archived Projects cannot provision a workspace.
Planning-only Projects retain permanent deletion. `PLAN` cannot be archived or deleted.
Migration leaves existing Projects planning-only.

## Following passes

1. Durable execution: dedicated worker process, stored attempts, cancellation and restart
   recovery; reuse the workflow host. Runs belong to Project/workspace and may link a
   session and planning task. Retry creates a new attempt.
2. Live Work sidebar: persisted progress/results and SSE with reconnect recovery.
   Browser closure does not cancel work. Completion updates cards without chat messages.
3. Context/delegation: inventories tied to identifiable revisions, source/planning links,
   retrieval and assistant dispatch for user-requested work. Workers store state outside
   session JSON and never overwrite conversation documents.

These passes need detailed plans after the preceding pass is tested. LLM streaming,
coding worktrees, integration and Git publishing remain subsequent work.

## Verification notes

Pass 1 was verified on Windows with temporary databases and Git repositories. Automated
checks cover migration, duplicate reservations, restart recovery, import branch/history,
Git error handling, URL redaction, archive/restore and failed retry. Browser checks cover
creation, refresh, reload, server restart, archive/restore, import failure and retry.
Live private-repository authentication was not exercised; no configured private test
repository was supplied. macOS/Linux folder launching was not exercised live.

For isolated development checks, `PROJECTPLANER_NEXT_DIST_DIR` selects a separate Next
output directory. Use a disposable `PROJECTPLANER_DB_PATH` and workspace root with
`PROJECTPLANER_PRESETS_SKIP=1`; restore any Next-generated type references afterward.

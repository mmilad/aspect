# Architecture

## Packages

- **`packages/core`** — Domain types (`domain/`), process/decision/question statuses, candidacy/scoring, workflow schema + step runner (`workflow/`, `generator/workflow`), legacy snapshot adapters (`legacy/`).
- **`packages/db`** — Process-local database controller, storage-neutral contracts and orchestration, and a private SQLite adapter. Workflows, presets, semantic writes, and parent rollup use typed storage operations.
- **`packages/mcp`** — Stdio MCP server wrapping db/core for Cursor agents.
- **`packages/workspace`** — Managed directory ownership, Git provisioning and inspection. Depends on core types; server orchestration connects it to SQLite. See [workspaces](./workspaces.md).
- **`apps/web`** — Next.js App Router UI + HTTP APIs used by the UI and `apps/agent`.
- **`apps/agent`** — Thin host: `WorkflowClient` + LLM adapters + run loop. No freeform tools; no direct DB.

Project key: **`PLAN`**.

## Living state

- Default DB path: repo-root `projectplaner.db` (`PROJECTPLANER_DB_PATH`).
- SQLite schema version 1 applies the existing schema, workspace, and status migrations atomically. Later opens check the version without rerunning data migrations. Future changes must add a numbered migration; do not alter version 1 to migrate existing databases.
- Workflow presets (`ensure_aspect`, CRUD `create_*` / `update_*` / `delete_*`, `next_work`, `onboarding`, `rollup_parent_status`, …) seed once. Force replace: `pnpm plan presets-ensure --force` or `PROJECTPLANER_PRESETS_FORCE=1`. Skip: `PROJECTPLANER_PRESETS_SKIP=1`.
- Soft-delete: `delete_*` archives (`status=archived`). Archived entities are excluded from default search/list/graph snapshots.

## Database access

Application code imports only the public `@projectplaner/db` entry point:

```ts
import { getDatabaseController } from "@projectplaner/db";

const database = getDatabaseController();
const project = await database.projects.findByKey("PLAN");
const entities = await database.entities.list({ projectKey: "PLAN" });
```

The singleton is shared through `globalThis` per resolved path and process, including Next route modules and development reloads. Its FIFO queue serializes database operations on one lazily opened connection. Pending work keeps it open; five idle seconds close it. CLI and MCP shutdown drain accepted work and close explicitly. Rejected operations do not poison the queue, and failed initialization releases its connection before allowing a retry.

Connections use foreign keys, WAL for file databases, and a 1,000 ms busy timeout. Separate processes still have separate controllers and SQLite still permits only one writer. The timeout bounds external contention; it does not automatically replay mutations. Catalog initialization checks existing presets without writes and acquires a transaction only for required changes.

`contracts/` owns DTOs and the asynchronous `Storage` interface. `services.ts` composes workflows and domain operations; transactions pass scoped storage directly and never re-enter the controller queue. Graph mutations and their rollup commit together. Semantic creation also groups its entity and relationship writes in one transaction.

Only `adapters/sqlite/` may contain SQLite imports, SQL, row mapping, and migrations. Its repositories remain separate internal modules. Application code does not import repositories or receive a driver handle. The controller is the composition root selecting this adapter. A future Postgres adapter implements `StorageFactory`/`Storage` and its own migrations; callers keep the same asynchronous operations.

LLM calls, Git, and filesystem provisioning run outside database operations. The web/MCP `withDb` helpers only pass the controller to orchestration; their callback does not hold a connection or occupy the database queue. Start/resume workflows and reserve/finalize workspaces with separate operations around external work.

`createDatabaseController({ path, storageFactory, idleMs, skipPresets, forcePresets })` creates an isolated controller for tests. `shutdown()` is terminal for that instance. Test-specific raw SQL belongs in the adapter's dedicated tests.

The import-boundary check runs in `pnpm typecheck` and rejects driver imports, repository deep imports, and statement preparation outside the adapter. Keep this guard when adding database operations.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Stale Next: stop `pnpm dev`, remove `apps/web/.next`, restart.

Stale MCP catalog: restart **projectplaner** under Customize → MCPs; discovery should match `packages/mcp/src/server.ts`.

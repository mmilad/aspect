# Architecture

## Packages

- **`packages/core`** — Domain types (`domain/`), process/decision/question statuses, candidacy/scoring, workflow schema + step runner (`workflow/`, `generator/workflow`), legacy snapshot adapters (`legacy/`).
- **`packages/db`** — SQLite via `node:sqlite`, migrations, repository, query layer, workflow run persistence, preset seeding, parent-status rollup. Storage adapter: domain logic stays in core.
- **`packages/mcp`** — Stdio MCP server wrapping db/core for Cursor agents.
- **`apps/web`** — Next.js App Router UI + HTTP APIs used by the UI and `apps/agent`.
- **`apps/agent`** — Thin host: `WorkflowClient` + LLM adapters + run loop. No freeform tools; no direct DB.

Project key: **`PLAN`**.

## Living state

- Default DB path: repo-root `projectplaner.db` (`PROJECTPLANER_DB_PATH`).
- Opening the DB runs schema migrations and an idempotent **status migration** onto the locked ladder.
- Workflow presets (`ensure_aspect`, CRUD `create_*` / `update_*` / `delete_*`, `next_work`, `onboarding`, `rollup_parent_status`, …) seed once. Force replace: `pnpm plan presets-ensure --force` or `PROJECTPLANER_PRESETS_FORCE=1`. Skip: `PROJECTPLANER_PRESETS_SKIP=1`.
- Soft-delete: `delete_*` archives (`status=archived`). Archived entities are excluded from default search/list/graph snapshots.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Stale Next: stop `pnpm dev`, remove `apps/web/.next`, restart.

Stale MCP catalog: restart **projectplaner** under Customize → MCPs; discovery should match `packages/mcp/src/server.ts`.

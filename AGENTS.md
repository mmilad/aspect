# Projectplaner

Local graph-first planning tool. Aspects are meaning anchors; Features and Tasks
attach to them. Not a Jira/Kanban clone.

Human-oriented overview and doc index: [`README.md`](README.md), [`docs/`](docs/).

## Agent orientation

Use the Projectplaner MCP for graph navigation and planning writes. Serialize
those calls (no parallel DB tools).

1. Call `orient` once per session (onboarding / rules — not a graph search).
2. Call `search` for relevant context, or `next_work` to pick an eligible task.
3. `get_entity` (and `packet_read` when consuming a handoff) before broad code reading.
4. On writes (`create_entity`, `update_entity`, `packet_write`), always pass `reason`.
   End with `packet_write` when handing off execution.

`relatedTo` means entities with an **outgoing** link **to** that id — not “children of
this parent.” A Feature that `contains` others will not list those children when you
pass the parent id; search by title, open the leaf Feature, or use `pnpm plan orient`.
Scope `next_work` to the Aspect/Feature tasks actually `implements`/`affects`. Relations
are directed; do not duplicate reverse `contains` edges.

Prefer a Feature when one fits; otherwise the smallest truthful Aspect; `Misc`
only when unclear. Leave follow-ups as linked graph tasks, not chat-only notes.

CLI fallback: `pnpm plan …`. SQLite is living state (no full-plan bootstrap seeder).
Workflow presets seed once into the DB (`ensure_aspect`, CRUD `create_*`/`update_*`/`delete_*`,
`next_work`, `onboarding`, …); use `pnpm plan presets-ensure --force` to replace preset graphs
during development (`PROJECTPLANER_PRESETS_FORCE=1`). Set `PROJECTPLANER_PRESETS_SKIP=1` to disable.
`delete_*` presets archive (`status=archived`) — never hard-delete.
Archived entities are soft-deleted: excluded from default `search` / `list` / project graph
snapshots. Recover with `get_entity` by id, or pass `includeArchived` on list/search APIs.
When a mutation preset is seeded, prefer MCP/HTTP `run_workflow` over direct create/update.
LLM steps pause as `pending_llm`; Cursor/Codex (or a new spawn) resume with `{ runId, llmWrites }`.
LLM `instructions` may use bag templates (`{{title}}`, `{{@reads}}`, `{{@shapes}}`); the runner
fills them from declared reads before returning `pending_llm`.
Work-node bag ports (`reads`/`writes` + `inputs`/`outputContracts`) are runtime-validated;
nullable upstream outputs only need a branch when the consumer rejects null. Config fields
(e.g. `llm.instructions`) are not bag ports — see `docs/workflow.md`.

## Architecture

- `apps/web` — Next.js App Router + React Flow graph
- `apps/agent` — thin semi-agent workflow host (run_workflow + pending_llm; no freeform tools)
- `packages/core` — domain types/helpers (`domain/`), workflow schema (`workflow/`), generators (`generator/`), legacy snapshot adapters (`legacy/`)
- `packages/db` — SQLite (`node:sqlite`) + repository (storage adapter; swap later without moving domain logic)
- `packages/mcp` — local stdio MCP
- Project key: `PLAN`

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Stale Next runtime: stop dev, remove `apps/web/.next`, restart `pnpm dev`.

Stale MCP tool catalog (missing `search` / `next_work`, old `orient` schema):
restart the Projectplaner MCP server in Cursor and confirm discovery matches
`packages/mcp/src/server.ts`.

## UX

Dense operational UI. Graph is primary. No marketing layouts.

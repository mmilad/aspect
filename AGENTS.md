# Projectplaner

Local graph-first planning tool. Aspects are meaning anchors; Features and Tasks
attach to them. Not a Jira/Kanban clone.

## Agent orientation

Use the Projectplaner MCP for graph navigation and planning writes (`orient`,
entity/relation tools, `packet_read` / `packet_write`). Serialize those calls.
Prefer a Feature when one fits; otherwise the smallest truthful Aspect; `Misc`
only when unclear. Leave follow-ups as linked graph tasks, not chat-only notes.

CLI fallback: `pnpm plan …`. SQLite is living state (no bootstrap seeder).

## Architecture

- `apps/web` — Next.js App Router + React Flow graph
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

## UX

Dense operational UI. Graph is primary. No marketing layouts.

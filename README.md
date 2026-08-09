# Projectplaner

Local **graph-first** planning tool. Aspects are meaning anchors; Features and Tasks attach to them. Not a Jira/Kanban clone — the graph is the plan, SQLite is living state, and agents work through MCP / workflows rather than freeform ticket churn.

## Why

- Keep planning as a **directed graph** (Aspect → Feature → Task, plus decisions/questions/flows).
- Give coding agents a stable MCP surface (`orient` → `search` / `next_work` → writes with `reason`).
- Run **defined** workflows (CRUD, ensure_aspect, rollup, next_work) instead of an open-ended agent tool loop.
- Ship a dense operational UI (graph primary; Issues / Kanban secondary).

## Quick start

```bash
pnpm install
pnpm dev                 # web UI + API at http://127.0.0.1:3000
```

Project key: **`PLAN`**. Database: `projectplaner.db` at the repo root (override with `PROJECTPLANER_DB_PATH`).

Cursor MCP is configured in [`.cursor/mcp.json`](.cursor/mcp.json). After code changes that touch MCP/DB, restart the **projectplaner** MCP under Customize → MCPs.

```bash
pnpm plan …              # CLI fallback for graph/preset ops
pnpm typecheck && pnpm test && pnpm build
```

## Repo layout

| Path | Role |
|------|------|
| [`apps/web`](apps/web) | Next.js App Router — graph, Issues, Kanban, workflow editor |
| [`apps/agent`](apps/agent) | Thin workflow host (start/resume + `pending_llm`) |
| [`packages/core`](packages/core) | Domain, status ladder, workflow schema/runner |
| [`packages/db`](packages/db) | SQLite + repository + presets/rollup |
| [`packages/mcp`](packages/mcp) | Local stdio MCP for Cursor/agents |

Agent session rules live in [`AGENTS.md`](AGENTS.md).

## Documentation

Current project docs (start here for “what exists today”):

| Doc | Topic |
|-----|--------|
| [`docs/architecture.md`](docs/architecture.md) | Packages, data ownership, verification |
| [`docs/graph.md`](docs/graph.md) | Entity model, relations, status ladder, rollup |
| [`docs/workflow.md`](docs/workflow.md) | Presets, `run_workflow`, `pending_llm`, Diagram (Mermaid) view |
| [`docs/mcp.md`](docs/mcp.md) | MCP tools and agent write rules |
| [`docs/agent.md`](docs/agent.md) | `apps/agent` CLI / HTTP client |
| [`docs/ui.md`](docs/ui.md) | Web surfaces and UX intent |

Index: [`docs/README.md`](docs/README.md).

## Usage sketch

```mermaid
flowchart TD
  human[Human in web UI] --> graph[(SQLite graph)]
  mcp[Cursor agent via MCP] --> orient[orient once]
  orient --> pick{search or next_work}
  pick --> read[get_entity / packet_read]
  read --> write[run_workflow or write + reason]
  write --> graph
  write --> handoff[packet_write handoff]
  host[apps/agent CLI] --> api[Web API run_workflow]
  api --> graph
  api --> llm{pending_llm?}
  llm -->|yes| resume[resume with llmWrites]
  resume --> api
```

1. **Humans** — open the web app, navigate the graph, edit entities / workflows.
2. **Agents in Cursor** — call Projectplaner MCP: `orient` once, then `search` or `next_work`; prefer `run_workflow` for mutations when presets are seeded; always pass `reason` on writes.
3. **Semi-agent host** — `pnpm --filter @projectplaner/agent start -- -w <preset> --fixtures` (needs `pnpm dev` for the API).

## Status

Active local monorepo. SQLite holds the live plan (no full-plan bootstrap seeder). Workflow presets seed once into the DB; force-reseed with `pnpm plan presets-ensure --force` during development.

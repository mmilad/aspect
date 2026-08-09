# Agent host (`apps/agent`)

Thin **semi-agent**: starts and resumes **defined** Projectplaner workflows. Not a freeform goal-loop.

## Role

- Talk to the web HTTP API (`/api/workflows/run`), not SQLite directly.
- On `pending_llm`, call a fixture / hook / model adapter, then resume with `llmWrites`.
- CLI + fixtures so LLM nodes are testable without Cursor.

## Non-goals

- Open-ended tools outside workflow nodes.
- Direct `@projectplaner/db` access.
- Embedding orchestration in `packages/core` (core already owns the runner).
- Coupling to Next.js UI components.

## Commands

```bash
pnpm --filter @projectplaner/agent start -- --help
pnpm --filter @projectplaner/agent start -- -w ensure_aspect --fixtures
pnpm --filter @projectplaner/agent start -- -w ensure_aspect --llm-hook "node ./path/to/hook.js"
```

Requires `pnpm dev` (API at `PROJECTPLANER_API_BASE_URL`, default `http://127.0.0.1:3000`).

## Pieces

- **`WorkflowClient`** — `start` / `resume` / `getRun` / `pendingLlm`
- **LLM adapters** — fixtures, callable glue, external `--llm-hook`
- **`runWorkflowLoop`** — auto-resume `pending_llm` until completed / failed / `pending_user`

More detail: [`../apps/agent/README.md`](../apps/agent/README.md).

For **Cursor agents** working the plan graph, use the MCP surface ([mcp.md](./mcp.md)), not this host.

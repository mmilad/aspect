# @projectplaner/agent

Thin **semi-agent** / workflow host for Projectplaner.

## Role

- Start and resume **defined** Projectplaner workflows (`run_workflow`).
- On `pending_llm`, call a model or fixture with instructions + declared reads, then resume with `llmWrites`.
- Provide CLI + fixtures so LLM nodes are testable.

## Non-goals

- Freeform goal-loop or open-ended tools outside workflow nodes.
- Direct SQLite / `@projectplaner/db` access.
- Next.js / web UI coupling.
- Embedding orchestration in `packages/core` (core already owns the runner).

## Config

| Env | Meaning |
|---|---|
| `PROJECTPLANER_API_BASE_URL` | HTTP API base (default `http://127.0.0.1:3000`) |

## Commands

```bash
pnpm --filter @projectplaner/agent start -- --help
pnpm --filter @projectplaner/agent typecheck
```

Scaffold only (PLAN-54). Client, LLM adapter, and run loop land in PLAN-55–57.

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
pnpm --filter @projectplaner/agent start -- -w ensure_aspect --fixtures
pnpm --filter @projectplaner/agent start -- -w ensure_aspect --llm-hook "node ./path/to/hook.js"
pnpm --filter @projectplaner/agent typecheck
```

Requires the Projectplaner web API (`pnpm dev`) for live runs.

## Client (PLAN-55)

`WorkflowClient` posts to `/api/workflows/run`:

- `start({ key | id, bag?, goal? })`
- `resume({ runId, llmWrites?, userRoute? })`
- `getRun(runId)`
- `pendingLlm(response)` → compact instructions/reads/outputSchema (no full graph)

Env: `PROJECTPLANER_API_BASE_URL` or `PROJECTPLANER_API_URL` (default `http://127.0.0.1:3000`).

## LLM adapter (PLAN-56)

- `FixtureLlmAdapter` / `fixtures/*.json` — deterministic resumes for tests
- `CallableLlmAdapter` — slim prompt glue + JSON → `llmWrites` (inject a real model later)
- `createHookLlmAdapter(cmd)` — live/small-model via external command
- `resumePendingWithAdapter(client, adapter, response)` — one pause/resume step

Prompts for workflow nodes stay on flow `instructionRef` / bag templates; the app only wraps them for the model.

## Run loop (PLAN-57)

`runWorkflowLoop` starts a preset/flow and auto-resumes `pending_llm` until completed/failed/`pending_user` (or max steps).

CLI: `--fixtures` for the deterministic path; `--llm-hook` (or `PROJECTPLANER_LLM_HOOK`) for an optional live model.

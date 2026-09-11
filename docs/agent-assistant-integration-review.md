# Agent Runtime / Assistant checkpoint

Reviewed 2026-09-11. No commit was created. The original 74-file staged batch
is preserved; cleanup edits and new files remain unstaged for review.

## Current behavior

Normal Assistant messages use /api/assistant/turn and persist in Assistant sessions.
Direct agent requests use synchronous POST /api/agents/run. Their prompts,
responses, status and run IDs persist separately. Selecting an agent restores
its project-scoped history, including older runs. The last ten completed exchanges
supply follow-up context; stored history is not truncated.

History loads on opening/selecting an agent conversation, after a submitted request
settles, on Refresh, and when the browser becomes visible again. Only known
queued/running runs refresh every two seconds. Completed, failed, canceled and
waiting runs generate no recurring requests. Hidden conversations and tabs stop
refreshing; obsolete requests are aborted.

Cards fetch operational events only when expanded. Expanded active runs fetch
incremental events; completed details are cached while mounted. Automatic refresh
stops after three consecutive failures, or immediately for a missing run.
Retry/Refresh starts a new attempt. SSE remains finite persisted replay supporting
after and Last-Event-ID; it is not live execution.

## Reliability and boundaries

- HTTP response contracts remain compatible. The UI validates AgentRun.id, retains
  messages during errors and renders separate agent cards inside the transcript.
- SQLite terminal transitions and their terminal events share a transaction.
  Existing terminal states win against late completion/cancellation and duplicate
  requests. Event-write failure rolls back the transition. A committed successful
  run is not subsequently changed to failed by the runtime.
- Transactional v2 migration behavior is preserved for fresh and existing v1
  databases without rewriting existing agents, runs or events.
- Recruitment persistence and runtime reads share validated profile normalization.
  Invalid policy values use defaults; valid values survive. External memory is disabled.
- Core runtime stays provider-neutral. Ollama uses the existing OpenAI-compatible
  adapter. Direct runtime has no executable tools; profile expertise is labeled
  separately. The UI and model receive the same capability description.
- SearXNG remains in recruitment, with a 15-second timeout, explicit service and
  malformed-response errors, and a 1–50 result limit.
- No private chain-of-thought is stored or displayed. Event details are operational
  status only. Historical responses remain unchanged; prompts cannot guarantee
  that a model never makes inaccurate claims.

## Main cleanup files

- apps/web/components/assistant/use-agent-messages.ts: conversation refresh owner.
- apps/web/components/assistant/refresh-loop.ts: bounded retries and cancellation.
- apps/web/components/assistant/use-agent-events.ts: lazy incremental replay.
- apps/web/components/assistant/use-page-visible.ts: visibility lifecycle.
- apps/web/components/assistant/agent-run-message.tsx: prompt, response and details.
- apps/web/components/project-shell/right-pane-context.tsx: send/refresh integration.
- packages/core/src/agents/profile.ts and capabilities.ts: shared normalization and labels.
- packages/core/src/agents/runtime/runtime.ts and terminal.ts: terminal handling.
- packages/db/src/adapters/sqlite/repositories/agent-runs.ts: atomic persistence.
- packages/db/src/web-search.ts: bounded, validated SearXNG requests.
- packages/core/src/workflow/presets/recruit_agent/: separated input/profile nodes.
- API handlers, profile overview and agent sidebar: readability and capability labels.

## Validation

Passed: pnpm typecheck, pnpm test, pnpm build, git diff --check.
Tests: 346 Vitest, 45 database tests and 2 MCP tests (393 total).
The pnpm commands used local configuration flags disabling package-manager
auto-installation and dependency reinstallation; repository scripts were unchanged.

Regression coverage includes refresh scheduling/retries/abort, Assistant and agent
response contracts, follow-up context, finite SSE replay and cursors, terminal races
and rollback, profile normalization, search validation/timeout/failure, deterministic
recruitment persistence and fresh/existing database migrations. Refresh-loop tests
exercise lifecycle primitives; they are not a full browser automation suite.

Browser checks on a fresh production build confirmed normal chat persistence,
direct agent history restoration, completed responses, lazy six-event replay,
cached collapse/reopen and absence of recurring idle agent requests.
Live SearXNG returned results and recruitment completed through the configured
llama3:latest model, persisting a Software test engineer agent.
A normal verification chat and direct-agent verification runs remain as test history.
One request against the stale development process was canceled during verification.

## Manual review steps

1. Restart the existing development process, then run pnpm dev.
2. Open PLAN, choose New chat, keep Debug agent set to Assistant and send a message.
   Reload and reopen that session; verify both the prompt and answer remain.
3. Select Coding Agent, send a question and verify its separate response card.
   Reload, reopen Assistant and select Coding Agent; verify saved prompts/results.
4. Switch to another agent and back; verify histories remain separate.
5. Open browser Network, filter /api/agents, and leave completed cards collapsed
   for at least ten seconds. There should be no recurring requests.
6. Expand a completed card: verify one event request and operational events.
   Collapse/reopen: verify cached details. Refresh explicitly reloads history.
7. Simulate network failure and click Refresh. Existing messages should remain;
   automatic requests stop after three failures. Restore network and click Retry.
8. Hide/show the browser tab: hidden refresh stops; returning reloads open history.

## Remaining scope

Execution remains synchronous, without a durable background worker or live tokens.
Direct history is one conversation per agent/project, not separate conversation IDs.
Next: explicit conversation IDs and nested breadcrumbs linking Assistant sessions
to agent conversations, before Assistant-driven delegation. File CRUD tools,
automatic routing, external memory and broader UI redesign remain deferred.

Proposed commit message after approval:
Stabilize agent recruitment, runtime persistence, and Assistant conversations
